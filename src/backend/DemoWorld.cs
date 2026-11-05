using Microsoft.VisualBasic.FileIO;
namespace Vsk.Pitch;

public sealed record DemoAction(string AgentId, string Type, string RequestId);
public sealed class DemoWorld(Engine engine, string seedPath)
{
    public const string DefaultAgent = "TEST-AGENT-001-044";
    public static readonly string[] Actions = ["property", "motor", "terminate-property", "terminate-motor", "advance-day", "reset"];
    public World Seed()
    {
        var world = new World();
        // Fixed stylized geographic positions, not inferred from company branch data.
        (double x, double y)[] points = [(19, 59), (14, 43), (4, 49), (21, 17), (26, 31), (18, 34), (10, 49), (15, 47), (17, 55), (23, 53), (25, 46), (12, 60), (13, 66), (17, 64), (20, 66), (24, 66), (25, 58), (27, 54), (28, 49), (31, 60), (37, 63), (35, 72), (48, 61), (64, 67), (94, 85)];
        var byBranch = new Dictionary<string, City>();
        foreach (var row in Csv("cities.csv"))
        {
            var i = world.Cities.Count;
            var point = points[i];
            var city = new City { Id = row["cityId"], Name = row["name"], MapX = point.x, MapY = point.y };
            byBranch.Add(row["branchId"], city); world.Cities.Add(city);
        }
        var scenarios = Csv("scenarios.csv").ToDictionary(r => r["agencyAgreementNumber"], r => r["scenario"]);
        var byAgreement = new Dictionary<string, Street>();
        foreach (var row in Csv("agents.csv"))
        {
            var city = byBranch[row["branchId"]];
            var agent = new Agent { Id = row["agentId"], CityId = city.Id, FirstName = row["firstName"], LastName = row["lastName"] };
            world.Agents.Add(agent.Id, agent);
            var street = new Street { Id = $"STREET-{agent.Id}", AgentId = agent.Id, Name = StreetName(agent), Scenario = scenarios[row["agencyAgreementNumber"]] };
            city.Streets.Add(street); byAgreement.Add(row["agencyAgreementNumber"], street);
        }
        var products = Csv("products.csv").ToDictionary(r => r["productCode"], r => r["demoCategory"]);
        var ids = new HashSet<string>();
        foreach (var row in Csv("contracts.csv").OrderBy(r => r["concludedAt"], StringComparer.Ordinal).ThenBy(r => r["contractId"], StringComparer.Ordinal))
        {
            if (!ids.Add(row["contractId"])) throw new InvalidDataException("Duplicate seed contract ID.");
            if (row["status"] != "active") throw new InvalidDataException("Pitch seed must be initial active snapshot.");
            var type = products[row["productCode"]];
            if (type == "property") world.SeedPropertyContracts++; else if (type == "motor") world.SeedMotorContracts++; else throw new InvalidDataException("Unknown synthetic product category.");
            engine.Apply(byAgreement[row["agencyAgreementNumber"]], type, DateTimeOffset.Parse(row["concludedAt"]));
        }
        if (world.Cities.Count != 25 || world.Cities.Any(c => c.Streets.Count != 50) || world.SeedPropertyContracts != 4175 || world.SeedMotorContracts != 28775)
            throw new InvalidDataException("Pitch requires original synthetic 25-city initial fixtures.");
        return world;
    }
    IEnumerable<Dictionary<string, string>> Csv(string filename)
    {
        using var parser = new TextFieldParser(Path.Combine(seedPath, filename), System.Text.Encoding.UTF8);
        parser.TextFieldType = FieldType.Delimited; parser.SetDelimiters(","); parser.HasFieldsEnclosedInQuotes = true;
        var header = parser.ReadFields() ?? throw new InvalidDataException("Missing CSV header.");
        while (!parser.EndOfData)
        {
            var fields = parser.ReadFields() ?? throw new InvalidDataException("Missing CSV row.");
            if (fields.Length != header.Length) throw new InvalidDataException("Invalid CSV columns.");
            yield return header.Select((key, i) => (key, fields[i])).ToDictionary(x => x.key, x => x.Item2);
        }
    }
    static string StreetName(Agent agent)
    {
        var first = agent.FirstName switch { "Иван" => "Ивана", "Алексей" => "Алексея", "Сергей" => "Сергея", "Дмитрий" => "Дмитрия", "Андрей" => "Андрея", "Михаил" => "Михаила", "Николай" => "Николая", "Павел" => "Павла", "Александр" => "Александра", _ => agent.FirstName };
        var last = agent.LastName.EndsWith("ов", StringComparison.Ordinal) || agent.LastName.EndsWith("ев", StringComparison.Ordinal) || agent.LastName.EndsWith("ин", StringComparison.Ordinal) ? agent.LastName + "а" : agent.LastName;
        return $"Улица {first} {last}";
    }
    public bool Act(World world, string viewer, string role, DemoAction action, DateTimeOffset utcNow)
    {
        ValidateViewer(world, viewer, role);
        if (!Actions.Contains(action.Type, StringComparer.Ordinal)) throw new DemoException(400, "Неизвестное действие.");
        if (string.IsNullOrWhiteSpace(action.RequestId) || action.RequestId.Length > 128 || action.RequestId.Any(c => !(char.IsAsciiLetterOrDigit(c) || c is '-' or '_' or '.' or ':')))
            throw new DemoException(400, "requestId: требуется ключ 1..128 из букв ASCII, цифр, - _ . :");
        if (action.AgentId != viewer) throw new DemoException(403, "Действия разрешены только для выбранной демо-персоны.");
        if (role == "director" && action.Type is not ("advance-day" or "reset")) throw new DemoException(403, "Директор — наблюдатель: продажи и расторжения запрещены.");
        var fingerprint = $"{viewer}|{action.AgentId}|{action.Type}";
        if (world.Requests.TryGetValue(action.RequestId, out var previous))
        {
            if (previous != fingerprint) throw new DemoException(409, "requestId уже использован для другого действия.");
            return false;
        }
        switch (action.Type)
        {
            case "reset":
                var initial = Seed(); world.Cities = initial.Cities; world.Agents = initial.Agents; world.OffsetSeconds = 0;
                world.SeedPropertyContracts = initial.SeedPropertyContracts; world.SeedMotorContracts = initial.SeedMotorContracts;
                break;
            case "advance-day": world.OffsetSeconds = checked(world.OffsetSeconds + 86400); engine.ProcessDue(world, utcNow.AddSeconds(world.OffsetSeconds)); break;
            default: engine.Apply(world.Cities.SelectMany(c => c.Streets).Single(s => s.AgentId == viewer), action.Type, utcNow.AddSeconds(world.OffsetSeconds)); break;
        }
        world.Requests.Add(action.RequestId, fingerprint); world.Version++;
        return true;
    }
    public static Agent ValidateViewer(World world, string viewer, string role)
    {
        if (role is not ("agent" or "director")) throw new DemoException(400, "Роль должна быть agent или director.");
        if (string.IsNullOrWhiteSpace(viewer) || !world.Agents.TryGetValue(viewer, out var agent)) throw new DemoException(404, "Тестовый агент не найден.");
        return agent;
    }
    public object Project(World world, string viewer, string role, DateTimeOffset utcNow)
    {
        var agent = ValidateViewer(world, viewer, role);
        return new
        {
            mode = "pitch",
            version = world.Version,
            now = utcNow.AddSeconds(world.OffsetSeconds),
            viewer = new { agentId = agent.Id, streetId = $"STREET-{agent.Id}", cityId = agent.CityId, firstName = agent.FirstName, lastName = agent.LastName, role },
            cities = world.Cities.Select(c => new
            {
                id = c.Id,
                name = c.Name,
                mapX = c.MapX,
                mapY = c.MapY,
                streets = c.Streets.Select(s => new
                {
                    id = s.Id,
                    agentId = s.AgentId,
                    name = (role == "director" ? c.Id == agent.CityId : s.AgentId == agent.Id) ? s.Name : null,
                    scenario = s.Scenario,
                    houses = s.Houses,
                    parking = s.Parking
                }).ToArray()
            }).ToArray()
        };
    }
}
