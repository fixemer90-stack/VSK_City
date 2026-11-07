using System.Text.Json.Serialization;
namespace Vsk.Pitch;

public sealed class House
{
    public string Id { get; set; } = "";
    public int LotIndex { get; set; }
    public int Xp { get; set; }
    public int Tier => new[] { 0, 11, 22, 33, 44, 56, 67, 78, 89, 100 }.Count(x => Xp >= x);
    public int Floors => new[] { 1, 3, 4, 5, 6, 9, 12, 14, 17, 25 }[Tier - 1];
    public string Status { get; set; } = "active";
    public DateTimeOffset? DemolishAt { get; set; }
}
public sealed class Parking
{
    public string Id { get; set; } = "";
    public int LotIndex { get; set; }
    public int Spaces { get; set; }
}
public sealed class Street
{
    public string Id { get; set; } = "";
    public string AgentId { get; set; } = "";
    public string? Name { get; set; }
    public string Scenario { get; set; } = "empty";
    public List<House> Houses { get; set; } = [];
    public List<Parking> Parking { get; set; } = [];
    public long NextId { get; set; } = 1;
}
public sealed class City
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public double MapX { get; set; }
    public double MapY { get; set; }
    public List<Street> Streets { get; set; } = [];
}
public sealed class Agent
{
    public string Id { get; set; } = "";
    public string CityId { get; set; } = "";
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
}
public sealed class World
{
    public long Version { get; set; } = 1;
    public long OffsetSeconds { get; set; }
    public List<City> Cities { get; set; } = [];
    public Dictionary<string, Agent> Agents { get; set; } = [];
    public Dictionary<string, string> Requests { get; set; } = [];
    public int SeedPropertyContracts { get; set; }
    public int SeedMotorContracts { get; set; }
}
public sealed class DemoException(int status, string message) : Exception(message)
{ public int Status { get; } = status; }
public sealed class Engine
{
    public void Apply(Street street, string type, DateTimeOffset now)
    {
        switch (type)
        {
            case "property":
                var added = new House { Id = $"{street.Id}-HOUSE-{street.NextId++:D8}", LotIndex = FreeLot(street) };
                street.Houses.Add(added);
                while (added.Xp < 100 && street.Parking.Count > 0) { RemoveParking(street); added.Xp++; }
                break;
            case "motor": AddXp(street); break;
            case "motor-100": for (int i = 0; i < 100; i++) AddXp(street); break;
            case "terminate-property":
                var pending = street.Houses.Where(h => h.Status == "active").OrderBy(h => h.Xp).ThenBy(h => h.Id, StringComparer.Ordinal).FirstOrDefault()
                    ?? throw new DemoException(409, "Нет активного дома для расторжения.");
                pending.Status = "pending_demolition"; pending.DemolishAt = now.AddHours(24); break;
            case "terminate-motor":
                if (street.Parking.Count > 0) { RemoveParking(street); break; }
                var maximum = street.Houses.Where(h => h.Xp > 0).OrderByDescending(h => h.Xp).ThenBy(h => h.Id, StringComparer.Ordinal).FirstOrDefault()
                    ?? throw new DemoException(409, "Нет моторного вклада для расторжения.");
                maximum.Xp--; break;
            default: throw new DemoException(400, "Неизвестное действие.");
        }
    }
    static void AddXp(Street street)
    {
        var house = street.Houses.Where(h => h.Status == "active" && h.Xp < 100).OrderBy(h => h.Xp).ThenBy(h => h.Id, StringComparer.Ordinal).FirstOrDefault();
        if (house is not null) { house.Xp++; return; }
        var parking = street.Parking.OrderBy(p => p.Id, StringComparer.Ordinal).FirstOrDefault(p => p.Spaces < 10);
        if (parking is null)
        {
            parking = new Parking { Id = $"{street.Id}-PARK-{street.NextId++:D8}", LotIndex = FreeLot(street) };
            street.Parking.Add(parking);
        }
        parking.Spaces++;
    }
    static void RemoveParking(Street street)
    {
        var parking = street.Parking.OrderByDescending(p => p.Id, StringComparer.Ordinal).First();
        if (--parking.Spaces == 0) street.Parking.Remove(parking);
    }
    static int FreeLot(Street street)
    {
        var used = street.Houses.Select(h => h.LotIndex).Concat(street.Parking.Select(p => p.LotIndex)).ToHashSet();
        int i = 0; while (used.Contains(i)) i++; return i;
    }
    public bool ProcessDue(World world, DateTimeOffset now)
    {
        bool changed = false;
        foreach (var street in world.Cities.SelectMany(c => c.Streets))
        {
            var due = street.Houses.Where(h => h.Status == "pending_demolition" && h.DemolishAt <= now).OrderBy(h => h.Id, StringComparer.Ordinal).ToList();
            foreach (var house in due)
            {
                street.Houses.Remove(house);
                for (int i = 0; i < house.Xp; i++) AddXp(street);
                changed = true;
            }
        }
        return changed;
    }
}
