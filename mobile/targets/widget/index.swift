import WidgetKit
import SwiftUI

// MARK: - Shared data

private let appGroup = "group.com.atsumilabs.skyfield"
private let dataKey = "widgetData"

/// Mirrors the RN `WidgetWeather` snapshot written via ExtensionStorage.
struct WidgetWeather: Decodable {
    var place: String
    var temp: String
    var condition: String
    var code: String
    var isDay: Bool
    var hi: String
    var lo: String
    var wind: String
    var humidity: String
    var updated: String
    var alertEvent: String?
    var alertColor: String?
    var nowcast: String?
}

private func loadWeather() -> WidgetWeather? {
    guard
        let defaults = UserDefaults(suiteName: appGroup),
        let raw = defaults.string(forKey: dataKey),
        let data = raw.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(WidgetWeather.self, from: data)
}

// MARK: - Theme

private let skyTop = Color(red: 0.165, green: 0.365, blue: 0.690)
private let skyBottom = Color(red: 0.055, green: 0.102, blue: 0.212)
private let fg = Color(red: 0.953, green: 0.965, blue: 0.988)
private let accent = Color(red: 1.0, green: 0.819, blue: 0.40)
private let blue = Color(red: 0.624, green: 0.784, blue: 0.941)

/// Map our condition codes to SF Symbols.
private func symbol(_ code: String, _ isDay: Bool) -> String {
    switch code {
    case "clear", "hot": return isDay ? "sun.max.fill" : "moon.stars.fill"
    case "partly": return isDay ? "cloud.sun.fill" : "cloud.moon.fill"
    case "cloudy": return "cloud.fill"
    case "overcast": return "smoke.fill"
    case "fog": return "cloud.fog.fill"
    case "drizzle", "rain", "showers": return "cloud.rain.fill"
    case "tstorm": return "cloud.bolt.rain.fill"
    case "snow", "sleet": return "cloud.snow.fill"
    case "wind": return "wind"
    case "cold": return "thermometer.snowflake"
    default: return "cloud.sun.fill"
    }
}

private func hexColor(_ hex: String?) -> Color {
    guard var h = hex, h.hasPrefix("#") else { return Color.orange }
    h.removeFirst()
    var int: UInt64 = 0
    Scanner(string: h).scanHexInt64(&int)
    let r, g, b: Double
    if h.count == 8 {
        r = Double((int >> 16) & 0xFF) / 255
        g = Double((int >> 8) & 0xFF) / 255
        b = Double(int & 0xFF) / 255
    } else {
        r = Double((int >> 16) & 0xFF) / 255
        g = Double((int >> 8) & 0xFF) / 255
        b = Double(int & 0xFF) / 255
    }
    return Color(red: r, green: g, blue: b)
}

// MARK: - Timeline

struct WeatherEntry: TimelineEntry {
    let date: Date
    let weather: WidgetWeather?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> WeatherEntry {
        WeatherEntry(date: Date(), weather: nil)
    }
    func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> Void) {
        completion(WeatherEntry(date: Date(), weather: loadWeather()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherEntry>) -> Void) {
        let entry = WeatherEntry(date: Date(), weather: loadWeather())
        // Ask iOS to refresh in 30 min; the app also reloads on data changes.
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Views

private struct Background: View {
    var body: some View {
        LinearGradient(colors: [skyTop, skyBottom], startPoint: .top, endPoint: .bottom)
    }
}

private struct AlertOrNowcast: View {
    let w: WidgetWeather
    var body: some View {
        if let alert = w.alertEvent {
            Text("⚠ \(alert)")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(.white)
                .lineLimit(1)
                .padding(.horizontal, 7).padding(.vertical, 2)
                .background(hexColor(w.alertColor)).cornerRadius(7)
        } else if let nc = w.nowcast {
            Text(nc).font(.system(size: 12, weight: .bold)).foregroundColor(Color(red: 0.5, green: 0.83, blue: 1.0)).lineLimit(1)
        } else {
            Text(w.condition).font(.system(size: 12)).foregroundColor(fg.opacity(0.7)).lineLimit(1)
        }
    }
}

struct SmallView: View {
    let w: WidgetWeather?
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let w {
                Text(w.place).font(.system(size: 12, weight: .bold)).foregroundColor(fg).lineLimit(1)
                HStack(spacing: 6) {
                    Image(systemName: symbol(w.code, w.isDay)).font(.system(size: 26)).symbolRenderingMode(.multicolor)
                    Text(w.temp).font(.system(size: 34, weight: .light)).foregroundColor(accent)
                }
                AlertOrNowcast(w: w)
                HStack(spacing: 10) {
                    Text("H \(w.hi)").font(.system(size: 12, weight: .bold)).foregroundColor(fg)
                    Text("L \(w.lo)").font(.system(size: 12, weight: .bold)).foregroundColor(blue)
                }
            } else {
                Text("Skyfield").font(.system(size: 13, weight: .bold)).foregroundColor(fg)
                Text("Open the app to set a location").font(.system(size: 11)).foregroundColor(fg.opacity(0.6))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(14)
    }
}

struct MediumView: View {
    let w: WidgetWeather?
    var body: some View {
        HStack(alignment: .center) {
            if let w {
                HStack(spacing: 8) {
                    Image(systemName: symbol(w.code, w.isDay)).font(.system(size: 40)).symbolRenderingMode(.multicolor)
                    Text(w.temp).font(.system(size: 44, weight: .light)).foregroundColor(accent)
                }
                Spacer()
                VStack(alignment: .leading, spacing: 3) {
                    Text(w.place).font(.system(size: 14, weight: .bold)).foregroundColor(fg).lineLimit(1)
                    AlertOrNowcast(w: w)
                    Text("\(w.wind) · \(w.humidity)").font(.system(size: 11)).foregroundColor(fg)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 3) {
                    Text("H \(w.hi)").font(.system(size: 14, weight: .bold)).foregroundColor(fg)
                    Text("L \(w.lo)").font(.system(size: 14, weight: .bold)).foregroundColor(blue)
                    Text(w.updated).font(.system(size: 10)).foregroundColor(fg.opacity(0.6))
                }
            } else {
                Text("Open Skyfield to set a location").font(.system(size: 13)).foregroundColor(fg.opacity(0.7))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 16).padding(.vertical, 10)
    }
}

struct SkyfieldWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry

    var body: some View {
        Group {
            if family == .systemSmall {
                SmallView(w: entry.weather)
            } else {
                MediumView(w: entry.weather)
            }
        }
        .containerBackground(for: .widget) { Background() }
    }
}

@main
struct SkyfieldWidget: Widget {
    let kind = "SkyfieldWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            SkyfieldWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Skyfield")
        .description("Current conditions, hi/lo, wind, and humidity.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
