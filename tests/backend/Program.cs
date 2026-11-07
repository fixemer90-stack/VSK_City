using Vsk.Pitch;
var engine = new Engine();
int passed = 0;
var now = DateTimeOffset.Parse("2026-11-05T12:00:00Z");
void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
void Test(string name, Action action) { action(); passed++; Console.WriteLine($"PASS {name}"); }
Street Empty() => new() { Id = "STREET-A", AgentId = "A" };
void Add(Street s, string type, int n = 1) { for (int i = 0; i < n; i++) engine.Apply(s, type, now); }
Test("property creates zero-XP one-floor house", () => { var s = Empty(); Add(s, "property"); Check(s.Houses.Count == 1 && s.Houses[0].Xp == 0 && s.Houses[0].Floors == 1, "new house"); });
Test("ten uniform thresholds cover every XP and both sides of every boundary", () =>
{
    int[] thresholds = [0, 11, 22, 33, 44, 56, 67, 78, 89, 100];
    int[] floors = [1, 3, 4, 5, 6, 9, 12, 14, 17, 25];
    for (int xp = 0; xp <= 100; xp++)
    {
        var h = new House { Xp = xp };
        int tier = thresholds.Count(t => xp >= t);
        Check(h.Tier == tier && h.Floors == floors[tier - 1], $"XP {xp}: expected tier {tier}, floors {floors[tier - 1]}, got {h.Tier}/{h.Floors}");
    }
    foreach (int threshold in thresholds.Skip(1))
    {
        var s = Empty(); Add(s, "property"); Add(s, "motor", threshold);
        int tier = s.Houses[0].Tier;
        Add(s, "terminate-motor");
        Check(s.Houses[0].Xp == threshold - 1 && s.Houses[0].Tier == tier - 1 && s.Houses[0].Floors == floors[tier - 2], $"termination below {threshold}");
    }
});
Test("motor-100 equals one hundred regular motor actions", () =>
{
    foreach (var houses in new[] { 0, 1, 3 })
    {
        var batch = Empty(); var sequential = Empty();
        Add(batch, "property", houses); Add(sequential, "property", houses);
        Add(batch, "motor", 97); Add(sequential, "motor", 97);
        Add(batch, "motor-100"); Add(sequential, "motor", 100);
        Check(System.Text.Json.JsonSerializer.Serialize(batch) == System.Text.Json.JsonSerializer.Serialize(sequential), "exact allocation and overflow parity");
    }
});
Test("motor selects lowest XP stable ID", () => { var s = Empty(); Add(s, "property", 10); Add(s, "motor", 23); Check(s.Houses.Count(h => h.Xp == 3) == 3 && s.Houses.Count(h => h.Xp == 2) == 7, "balanced XP"); Check(s.Houses[0].Xp == 3, "stable ID"); });
Test("overflow uses sequential ten-space modules", () => { var s = Empty(); Add(s, "property"); Add(s, "motor", 123); Check(s.Houses[0].Xp == 100 && s.Parking.Select(p => p.Spaces).SequenceEqual(new[] { 10, 10, 3 }), "overflow"); });
Test("new property transfers parking without changing old XP", () => { var s = Empty(); Add(s, "motor", 123); Add(s, "property"); Check(s.Houses[0].Xp == 100 && s.Parking.Sum(p => p.Spaces) == 23, "first transfer"); Add(s, "property"); Check(s.Houses[0].Xp == 100 && s.Houses[1].Xp == 23 && s.Parking.Count == 0, "second transfer"); });
Test("new property preserves existing XP", () => { var s = Empty(); Add(s, "property"); Add(s, "motor", 15); Add(s, "property"); Check(s.Houses[0].Xp == 15 && s.Houses[1].Xp == 0, "no dilution"); });
Test("motor termination removes parking before XP and crosses tiers", () => { var s = Empty(); Add(s, "property"); Add(s, "motor", 101); Add(s, "terminate-motor"); Check(s.Parking.Count == 0 && s.Houses[0].Xp == 100, "parking first"); Add(s, "terminate-motor"); Check(s.Houses[0].Xp == 99 && s.Houses[0].Tier == 9, "tier decrease"); });
Test("pending house holds lot and XP but receives no new XP", () => { var s = Empty(); Add(s, "property"); Add(s, "motor", 8); var id = s.Houses[0].Id; Add(s, "terminate-property"); Check(s.Houses[0].Status == "pending_demolition" && s.Houses[0].Xp == 8 && s.Houses[0].DemolishAt == now.AddDays(1), "pending"); Add(s, "motor"); Check(s.Houses[0].Xp == 8 && s.Parking.Sum(p => p.Spaces) == 1, "exclude pending"); Check(s.Parking[0].LotIndex != s.Houses[0].LotIndex && s.Houses[0].Id == id, "held lot"); });
Test("motor removes XP from pending maximum", () => { var s = Empty(); Add(s, "property"); Add(s, "motor", 8); Add(s, "terminate-property"); Add(s, "property"); Add(s, "terminate-motor"); Check(s.Houses[0].Xp == 7 && s.Houses[0].Status == "pending_demolition" && s.Houses.Count == 2, "pending not immune"); });
Test("multiple pending demolish once and conserve XP", () => { var s = Empty(); Add(s, "property", 2); Add(s, "motor", 23); Add(s, "terminate-property", 2); Check(s.Houses.All(h => h.Status == "pending_demolition"), "exclude already pending"); var w = new World { Cities = [new City { Streets = [s] }] }; Check(!engine.ProcessDue(w, now.AddHours(23)), "not early"); Check(engine.ProcessDue(w, now.AddDays(1)), "due at deadline"); Check(s.Houses.Count == 0 && s.Parking.Sum(p => p.Spaces) == 23, "redistribute all"); Check(!engine.ProcessDue(w, now.AddDays(2)) && s.Parking.Sum(p => p.Spaces) == 23, "not twice"); });
Test("demolition redistributes to active and first free lot is reused", () => { var s = Empty(); Add(s, "property", 2); Add(s, "motor", 11); var removed = s.Houses[1]; Add(s, "terminate-property"); var w = new World { Cities = [new City { Streets = [s] }] }; engine.ProcessDue(w, now.AddDays(1)); Check(s.Houses.Count == 1 && s.Houses[0].Xp == 11, "redistribution"); Add(s, "property"); Check(s.Houses[1].LotIndex == removed.LotIndex && s.Houses[1].Id != removed.Id, "free lot stable IDs"); });
Test("invalid and impossible actions are real errors", () => { var s = Empty(); foreach (var type in new[] { "bogus", "terminate-property", "terminate-motor" }) { try { Add(s, type); throw new Exception("expected error"); } catch (DemoException e) { Check(e.Status is 400 or 409, "error status"); } } });
var demo = new DemoWorld(engine, Environment.GetEnvironmentVariable("DEMO_SEED_PATH") ?? "data/demo/initial");
Test("legacy saved world reprojects derived tiers without migrating authoritative state", () =>
{
    var legacy = new World
    {
        Version = 73, OffsetSeconds = 3600, SeedPropertyContracts = 8, SeedMotorContracts = 259,
        Agents = new() { ["A"] = new Agent { Id = "A", CityId = "C", FirstName = "Иван", LastName = "Иванов" } },
        Requests = new() { ["receipt-old"] = "A|A|terminate-property" },
        Cities = [new City { Id = "C", Name = "Сохранённый город", MapX = 19, MapY = 59,
            Streets = [new Street { Id = "STREET-A", AgentId = "A", Name = "Улица Ивана Иванова", NextId = 900,
                Houses = Enumerable.Range(0, 8).Select(i => new House { Id = $"OLD-{i}", LotIndex = i * 2,
                    Xp = new[] { 0, 3, 8, 15, 25, 40, 65, 100 }[i],
                    Status = i == 0 ? "pending_demolition" : "active", DemolishAt = i == 0 ? now.AddDays(1) : null }).ToList(),
                Parking = [new Parking { Id = "OLD-PARK", LotIndex = 17, Spaces = 3 }] }] }]
    };
    var options = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web);
    var saved = System.Text.Json.Nodes.JsonNode.Parse(System.Text.Json.JsonSerializer.Serialize(legacy, options))!;
    var oldHouses = saved["cities"]![0]!["streets"]![0]!["houses"]!.AsArray();
    for (int i = 0; i < oldHouses.Count; i++)
    {
        oldHouses[i]!["tier"] = i + 1;
        oldHouses[i]!["floors"] = new[] { 2, 5, 9, 16, 25, 40, 60, 100 }[i];
    }
    // Same JSON deserialization and projection used by WorldStore.Execute, no DB or Redis needed.
    var loaded = System.Text.Json.JsonSerializer.Deserialize<World>(saved.ToJsonString(), options)!;
    using var projection = System.Text.Json.JsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(demo.Project(loaded, "A", "agent", now), options));
    Check(projection.RootElement.TryGetProperty("rulesVersion", out var rulesVersion) && rulesVersion.GetInt32() == 2, "rulesVersion 2 invalidates cached projections without changing world version");
    var houses = projection.RootElement.GetProperty("cities")[0].GetProperty("streets")[0].GetProperty("houses").EnumerateArray().ToArray();
    Check(houses.Select(h => h.GetProperty("tier").GetInt32()).SequenceEqual(new[] { 1, 1, 1, 2, 3, 4, 6, 10 }), "ignore persisted old tiers");
    Check(houses.Select(h => h.GetProperty("floors").GetInt32()).SequenceEqual(new[] { 1, 1, 1, 3, 4, 5, 9, 25 }), "ignore persisted old floors; max 25");
    Check(!demo.Act(loaded, "A", "agent", new("A", "terminate-property", "receipt-old"), now.AddHours(1)), "old receipt still prevents duplicate action");
    var after = System.Text.Json.Nodes.JsonNode.Parse(System.Text.Json.JsonSerializer.Serialize(loaded, options))!;
    foreach (var document in new[] { saved, after })
        foreach (var house in document["cities"]![0]!["streets"]![0]!["houses"]!.AsArray())
        { house!.AsObject().Remove("tier"); house.AsObject().Remove("floors"); }
    Check(System.Text.Json.Nodes.JsonNode.DeepEquals(saved, after), "XP, IDs, lots, parking, deadlines, receipts, version, clock and metadata unchanged");
    Check(loaded.Cities[0].Streets[0].Houses.Sum(h => h.Xp) + loaded.Cities[0].Streets[0].Parking.Sum(p => p.Spaces) == 259, "legacy contribution conserved");
});
World seeded = null!;
Test("CSV seed is exact 25x50, 4175 houses and 28775 motor", () => { seeded = demo.Seed(); Check(seeded.Cities.Count == 25 && seeded.Cities.All(c => c.Streets.Count == 50), "cities and streets"); Check(seeded.SeedPropertyContracts == 4175 && seeded.SeedMotorContracts == 28775, "contract counts"); Check(seeded.Cities.SelectMany(c => c.Streets).Sum(s => s.Houses.Count) == 4175, "one contract one house"); Check(seeded.Cities.SelectMany(c => c.Streets).Sum(s => s.Houses.Sum(h => h.Xp) + s.Parking.Sum(p => p.Spaces)) == 28775, "motor conserved"); });
Test("privacy projection has no hidden names or internal fields", () => { var opts = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web); using var doc = System.Text.Json.JsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(demo.Project(seeded, "TEST-AGENT-001-044", "agent", now), opts)); var root = doc.RootElement; Check(root.GetProperty("mode").GetString() == "pitch", "mode"); Check(root.GetProperty("cities").EnumerateArray().SelectMany(c => c.GetProperty("streets").EnumerateArray()).Count(s => s.GetProperty("name").ValueKind != System.Text.Json.JsonValueKind.Null) == 1, "only own name"); Check(!root.TryGetProperty("agents", out _) && !root.TryGetProperty("requests", out _), "no internal metadata"); foreach (var s in root.GetProperty("cities").EnumerateArray().SelectMany(c => c.GetProperty("streets").EnumerateArray())) Check(s.EnumerateObject().Select(p => p.Name).Order().SequenceEqual(new[] { "id", "agentId", "name", "scenario", "houses", "parking" }.Order()), "exact street fields"); using var director = System.Text.Json.JsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(demo.Project(seeded, "TEST-AGENT-001-044", "director", now), opts)); Check(director.RootElement.GetProperty("cities").EnumerateArray().SelectMany(c => c.GetProperty("streets").EnumerateArray()).Count(s => s.GetProperty("name").ValueKind != System.Text.Json.JsonValueKind.Null) == 50, "director city only"); });
Test("idempotency survives JSON roundtrip and protects deadlines", () => { var w = demo.Seed(); var a = "TEST-AGENT-001-044"; var action = new DemoAction(a, "terminate-property", "request-1"); demo.Act(w, a, "agent", action, now); var s = w.Cities[0].Streets.Single(s => s.AgentId == a); var deadline = s.Houses.Single(h => h.Status == "pending_demolition").DemolishAt; w = System.Text.Json.JsonSerializer.Deserialize<World>(System.Text.Json.JsonSerializer.Serialize(w))!; Check(!demo.Act(w, a, "agent", action, now.AddHours(1)), "duplicate no mutation"); s = w.Cities[0].Streets.Single(s => s.AgentId == a); Check(s.Houses.Count(h => h.Status == "pending_demolition") == 1 && s.Houses.Single(h => h.Status == "pending_demolition").DemolishAt == deadline, "deadline persisted"); });
Test("motor-100 is one idempotent agent-only action", () =>
{
    var w = demo.Seed(); var a = "TEST-AGENT-001-001";
    var street = w.Cities.SelectMany(c => c.Streets).Single(s => s.AgentId == a);
    int before = street.Houses.Sum(h => h.Xp) + street.Parking.Sum(p => p.Spaces);
    long version = w.Version; var action = new DemoAction(a, "motor-100", "batch-100");
    Check(demo.Act(w, a, "agent", action, now), "batch accepted");
    Check(street.Houses.Sum(h => h.Xp) + street.Parking.Sum(p => p.Spaces) == before + 100 && w.Version == version + 1, "exact hundred in one version");
    Check(!demo.Act(w, a, "agent", action, now), "retry is idempotent");
    try { demo.Act(w, a, "director", new(a, "motor-100", "director-batch"), now); throw new Exception("expected rejection"); }
    catch (DemoException e) { Check(e.Status == 403, "director forbidden"); }
});
Test("reset is idempotent and retains old request receipts", () => { var w = demo.Seed(); var a = "TEST-AGENT-001-001"; demo.Act(w, a, "agent", new(a, "property", "before-reset"), now); demo.Act(w, a, "director", new(a, "reset", "reset-key"), now); demo.Act(w, a, "agent", new(a, "property", "after-reset"), now); Check(!demo.Act(w, a, "director", new(a, "reset", "reset-key"), now), "duplicate reset"); Check(!demo.Act(w, a, "agent", new(a, "property", "before-reset"), now), "receipt survives reset"); Check(w.Cities[0].Streets[0].Houses.Count == 1, "duplicate reset does not erase new sale"); });
Test("director observer and request validation", () => { var w = demo.Seed(); var a = "TEST-AGENT-001-044"; foreach (var item in new[] { ("director", new DemoAction(a, "motor", "x"), 403), ("agent", new DemoAction(a, "bogus", "x"), 400), ("agent", new DemoAction(a, "motor", ""), 400), ("agent", new DemoAction("TEST-AGENT-002-001", "motor", "x"), 403), ("invalid", new DemoAction(a, "motor", "x"), 400) }) { try { demo.Act(w, a, item.Item1, item.Item2, now); throw new Exception("expected rejection"); } catch (DemoException e) { Check(e.Status == item.Item3, "status"); } } });
Console.WriteLine($"TOTAL {passed} passed");
