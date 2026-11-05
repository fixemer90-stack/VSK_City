using System.Text.Json;
using Npgsql;
using StackExchange.Redis;
using Vsk.Pitch;

if (args.Contains("--health-check"))
{
    try { using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(4) }; var response = await http.GetAsync("http://127.0.0.1:8080/health"); return response.IsSuccessStatusCode ? 0 : 1; }
    catch { return 1; }
}
var builder = WebApplication.CreateBuilder(args);
string Required(string key) => !string.IsNullOrWhiteSpace(builder.Configuration[key]) ? builder.Configuration[key]! : throw new InvalidOperationException($"Missing required environment setting: {key}");
if (Required("DEMO_MODE") != "pitch") throw new InvalidOperationException("This executable only supports synthetic pitch mode.");
var pg = Required("POSTGRES_CONNECTION");
if (new NpgsqlConnectionStringBuilder(pg).Database != "vsk_pitch") throw new InvalidOperationException("Pitch requires a dedicated database named vsk_pitch. Never use a corporate database.");
var cache = Required("REDIS_CONNECTION");
var seedPath = Required("DEMO_SEED_PATH");
if (!Directory.Exists(seedPath)) throw new InvalidOperationException("DEMO_SEED_PATH does not exist.");
if (!int.TryParse(Required("DEMOLITION_POLL_SECONDS"), out var poll) || poll < 1 || poll > 3600) throw new InvalidOperationException("DEMOLITION_POLL_SECONDS must be 1..3600.");
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 4096);
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
builder.Services.AddSingleton<Engine>();
builder.Services.AddSingleton(provider => new DemoWorld(provider.GetRequiredService<Engine>(), seedPath));
builder.Services.AddSingleton(NpgsqlDataSource.Create(pg));
builder.Services.AddSingleton<IConnectionMultiplexer>(await ConnectionMultiplexer.ConnectAsync(cache));
builder.Services.AddSingleton<WorldStore>();
builder.Services.AddHostedService<DemolitionWorker>();
var app = builder.Build();
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    try { await next(); }
    catch (Exception e)
    {
        if (context.Response.HasStarted) throw;
        var status = e switch { DemoException d => d.Status, JsonException => 400, BadHttpRequestException => 400, NpgsqlException => 503, RedisException => 503, OperationCanceledException => 503, _ => 500 };
        var message = e switch { DemoException d => d.Message, JsonException or BadHttpRequestException => "Некорректный JSON или параметры запроса.", NpgsqlException or RedisException => "Хранилище демо временно недоступно.", _ => "Ошибка обработки демо. Повторите запрос с прежним requestId." };
        if (status >= 500) app.Logger.LogError("Pitch request failed ({ErrorType}).", e.GetType().Name);
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new { message });
    }
});
app.MapGet("/health", async (WorldStore store, CancellationToken ct) =>
{
    var health = await store.Health(ct);
    return Results.Json(new { status = health.Postgres && health.Redis ? "healthy" : "unhealthy", postgres = health.Postgres ? "up" : "down", redis = health.Redis ? "up" : "down" }, statusCode: health.Postgres && health.Redis ? 200 : 503);
});
app.MapGet("/api/demo/state", async (HttpContext context, WorldStore store, CancellationToken ct) =>
{
    var viewer = context.Request.Query["agentId"].FirstOrDefault() ?? DemoWorld.DefaultAgent;
    var role = context.Request.Query["role"].FirstOrDefault() ?? "agent";
    return Results.Json(await store.Execute(viewer, role, ct: ct));
});
app.MapPost("/api/demo/actions", async (HttpContext context, WorldStore store, CancellationToken ct) =>
{
    var viewer = context.Request.Query["agentId"].FirstOrDefault() ?? DemoWorld.DefaultAgent;
    var role = context.Request.Query["role"].FirstOrDefault() ?? "agent";
    var action = await context.Request.ReadFromJsonAsync<DemoAction>(ct) ?? throw new DemoException(400, "Требуется JSON действия.");
    return Results.Json(await store.Execute(viewer, role, action, ct));
});
app.MapFallback(() => Results.Json(new { message = "Маршрут не найден." }, statusCode: 404));
await app.Services.GetRequiredService<WorldStore>().Initialize();
app.Logger.LogWarning("SYNTHETIC LOCALHOST PITCH ONLY. Demo role selection is NOT authentication. Do not expose externally or load personal/corporate data.");
await app.RunAsync();
return 0;
