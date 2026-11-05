using System.Text.Json;
using Npgsql;
using NpgsqlTypes;
using StackExchange.Redis;
namespace Vsk.Pitch;

// This single-row JSONB store is intentionally only the synthetic pitch schema.
// Each request/worker reads PostgreSQL under a row lock; no in-memory world is authoritative.
public sealed class WorldStore(NpgsqlDataSource postgres, IConnectionMultiplexer redis, DemoWorld demo, Engine engine, ILogger<WorldStore> logger)
{
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public async Task Initialize(CancellationToken ct = default)
    {
        await using var connection = await postgres.OpenConnectionAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        await using (var gate = new NpgsqlCommand("SELECT pg_advisory_xact_lock(871298051)", connection, tx)) await gate.ExecuteNonQueryAsync(ct);
        await using (var schema = new NpgsqlCommand("CREATE TABLE IF NOT EXISTS pitch_world (id integer PRIMARY KEY CHECK(id=1), state jsonb NOT NULL)", connection, tx)) await schema.ExecuteNonQueryAsync(ct);
        await using (var exists = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM pitch_world WHERE id=1)", connection, tx))
        {
            if (!(bool)(await exists.ExecuteScalarAsync(ct))!)
            {
                var seed = demo.Seed();
                await using var insert = new NpgsqlCommand("INSERT INTO pitch_world(id,state) VALUES(1,@state)", connection, tx);
                insert.Parameters.AddWithValue("state", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(seed, Json));
                await insert.ExecuteNonQueryAsync(ct);
            }
        }
        await tx.CommitAsync(ct);
    }
    public async Task<object?> Execute(string? viewer = null, string role = "agent", DemoAction? action = null, CancellationToken ct = default)
    {
        await using var connection = await postgres.OpenConnectionAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        World world;
        await using (var read = new NpgsqlCommand("SELECT state::text FROM pitch_world WHERE id=1 FOR UPDATE", connection, tx))
            world = JsonSerializer.Deserialize<World>((string)(await read.ExecuteScalarAsync(ct) ?? throw new InvalidOperationException("Pitch world is not initialized.")), Json)!;
        var utcNow = DateTimeOffset.UtcNow;
        if (viewer is not null) DemoWorld.ValidateViewer(world, viewer, role);
        var changed = engine.ProcessDue(world, utcNow.AddSeconds(world.OffsetSeconds));
        if (changed) world.Version++;
        if (action is not null) changed = demo.Act(world, viewer!, role, action, utcNow) || changed;
        if (changed)
        {
            await using var write = new NpgsqlCommand("UPDATE pitch_world SET state=@state WHERE id=1", connection, tx);
            write.Parameters.AddWithValue("state", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(world, Json));
            await write.ExecuteNonQueryAsync(ct);
        }
        var result = viewer is null ? null : demo.Project(world, viewer, role, utcNow);
        await tx.CommitAsync(ct);
        // Redis is reconstructible, and cannot turn a committed sale into an HTTP failure.
        try
        {
            await redis.GetDatabase().ScriptEvaluateAsync(
                "local old=redis.call('GET',KEYS[1]); if not old or tonumber(old)<=tonumber(ARGV[1]) then redis.call('SET',KEYS[1],ARGV[1],'EX',600) end; return 1",
                [new RedisKey("pitch:world:version")], [(RedisValue)world.Version]);
        }
        catch (RedisException) { logger.LogWarning("Pitch version cache unavailable; PostgreSQL remains authoritative."); }
        return result;
    }
    public async Task<(bool Postgres, bool Redis)> Health(CancellationToken ct)
    {
        bool pg = false, cache = false;
        try { await using var command = postgres.CreateCommand("SELECT 1"); pg = (int)(await command.ExecuteScalarAsync(ct))! == 1; } catch (Exception e) when (e is NpgsqlException or TimeoutException) { }
        try { await redis.GetDatabase().PingAsync(); cache = true; } catch (RedisException) { }
        return (pg, cache);
    }
}

public sealed class DemolitionWorker(WorldStore store, IConfiguration config, ILogger<DemolitionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(int.Parse(config["DEMOLITION_POLL_SECONDS"]!)));
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try { await store.Execute(ct: stoppingToken); }
                catch (Exception e) when (e is not OperationCanceledException) { logger.LogWarning("Pitch demolition check failed ({ErrorType}); will retry.", e.GetType().Name); }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }
}
