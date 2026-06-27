import WidgetKit
import SwiftUI

// MARK: - Shared data

private let appGroup = "group.com.atsumilabs.skyfield"
private let dataKey = "widgetData"     // last rendered snapshot (fallback / instant render)
private let configKey = "widgetConfig" // location + units the app writes so the widget can fetch itself

/// Mirrors the RN `WidgetWeather` snapshot.
struct WidgetWeather: Codable {
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
    // Next-2h precip chart (banner rain state). The Swift self-fetch can't
    // compute the radar nowcast, so these are carried forward from the last RN
    // app snapshot; nil/empty → the banner stays in its normal layout.
    var nowcastBars: [Int]?
    var nowcastNowIdx: Int?
}

/// Location + unit preferences the RN app writes (see src/widgets/iosWidget.ts)
/// so the widget extension can fetch fresh weather on its own timeline.
struct WidgetConfig: Decodable {
    var lat: Double
    var lon: Double
    var place: String
    var tempUnit: String // "F" | "C"
    var windUnit: String // "mph" | "kmh" | "ms" | "kn"
}

private func sharedDefaults() -> UserDefaults? { UserDefaults(suiteName: appGroup) }

private func loadWeather() -> WidgetWeather? {
    guard let raw = sharedDefaults()?.string(forKey: dataKey),
          let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WidgetWeather.self, from: data)
}

private func saveWeather(_ w: WidgetWeather) {
    guard let data = try? JSONEncoder().encode(w),
          let str = String(data: data, encoding: .utf8) else { return }
    sharedDefaults()?.set(str, forKey: dataKey)
}

private func loadConfig() -> WidgetConfig? {
    guard let raw = sharedDefaults()?.string(forKey: configKey),
          let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WidgetConfig.self, from: data)
}

// MARK: - NWS fetch (mirrors src/lib/nws + weather/condition + format/units —
// keep in sync; this is the option-(a) Swift duplicate of the TS brain, core
// scope: no nowcast).

private struct QV: Decodable { let value: Double?; let unitCode: String? }

private struct PointsResp: Decodable {
    struct Props: Decodable { let forecast: String; let observationStations: String }
    let properties: Props
}
private struct StationsResp: Decodable {
    struct Feature: Decodable {
        struct P: Decodable { let stationIdentifier: String; let name: String? }
        let properties: P
    }
    let features: [Feature]
}
private struct ObsResp: Decodable {
    struct Props: Decodable {
        let textDescription: String?
        let icon: String?
        let temperature: QV
        let relativeHumidity: QV
        let windDirection: QV
        let windSpeed: QV
    }
    let properties: Props
}
private struct ForecastResp: Decodable {
    struct Period: Decodable {
        let isDaytime: Bool
        let temperature: Double?
        let shortForecast: String?
        let icon: String?
    }
    struct Props: Decodable { let periods: [Period] }
    let properties: Props
}
private struct AlertsResp: Decodable {
    struct Feature: Decodable {
        struct P: Decodable { let event: String; let severity: String? }
        let properties: P
    }
    let features: [Feature]
}

private func trim4(_ n: Double) -> String { String(format: "%.4f", n) }

private func nwsGet<T: Decodable>(_ type: T.Type, _ urlString: String) async throws -> T {
    guard let url = URL(string: urlString) else { throw URLError(.badURL) }
    var req = URLRequest(url: url)
    req.setValue("application/geo+json", forHTTPHeaderField: "Accept")
    // Native (unlike the browser) may set User-Agent, which NWS asks for.
    req.setValue("Skyfield/1.0 (atsumilabs.com)", forHTTPHeaderField: "User-Agent")
    let (data, resp) = try await URLSession.shared.data(for: req)
    guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
        throw URLError(.badServerResponse)
    }
    return try JSONDecoder().decode(T.self, from: data)
}

/// Normalize a wind quantity to km/h based on its unit code (mirrors windToKph).
private func windToKph(_ q: QV?) -> Double? {
    guard let q = q, let v = q.value else { return nil }
    if let u = q.unitCode {
        if u.contains("m_s") { return v * 3.6 }
        if u.contains("mi_h") || u.contains("mph") { return v * 1.609 }
    }
    return v
}

/// Walk the first few stations until one reports a temperature.
private func fetchObservation(_ stationsUrl: String) async -> ObsResp.Props? {
    guard let stations = try? await nwsGet(StationsResp.self, stationsUrl) else { return nil }
    for station in stations.features.prefix(4) {
        let id = station.properties.stationIdentifier
        if let obs = try? await nwsGet(ObsResp.self,
                                       "https://api.weather.gov/stations/\(id)/observations/latest"),
           obs.properties.temperature.value != nil {
            return obs.properties
        }
    }
    return nil
}

private func fetchWidgetWeather(_ cfg: WidgetConfig) async -> WidgetWeather? {
    guard let pts = try? await nwsGet(
        PointsResp.self,
        "https://api.weather.gov/points/\(trim4(cfg.lat)),\(trim4(cfg.lon))"
    ) else { return nil }

    async let obsA = fetchObservation(pts.properties.observationStations)
    async let fcA = nwsGet(ForecastResp.self, pts.properties.forecast)
    async let alA = nwsGet(
        AlertsResp.self,
        "https://api.weather.gov/alerts/active?point=\(trim4(cfg.lat)),\(trim4(cfg.lon))"
    )

    let obs = await obsA
    let periods = (try? await fcA)?.properties.periods ?? []
    let alerts = (try? await alA)?.features ?? []

    return buildWidgetWeather(cfg: cfg, obs: obs, periods: periods, alerts: alerts)
}

/// Treat empty strings as missing — mirrors JS `||` fallback (Swift `??` only
/// catches nil, so an NWS empty-string textDescription/icon must fall through).
private func nz(_ s: String?) -> String? {
    guard let s = s, !s.isEmpty else { return nil }
    return s
}

private func buildWidgetWeather(
    cfg: WidgetConfig,
    obs: ObsResp.Props?,
    periods: [ForecastResp.Period],
    alerts: [AlertsResp.Feature]
) -> WidgetWeather {
    let today = periods.first
    let hiF = periods.first(where: { $0.isDaytime })?.temperature
    let loF = periods.first(where: { !$0.isDaytime })?.temperature
    let cond = parseCondition(nz(obs?.textDescription) ?? today?.shortForecast ?? "",
                              nz(obs?.icon) ?? today?.icon)
    let topAlert = alerts.min(by: {
        severityRank($0.properties.severity) < severityRank($1.properties.severity)
    })
    let humidity = obs?.relativeHumidity.value

    return WidgetWeather(
        place: cfg.place,
        temp: "\(displayTemp(obs?.temperature.value, cfg.tempUnit))°",
        condition: nz(obs?.textDescription) ?? today?.shortForecast ?? "—",
        code: cond.code,
        isDay: cond.isDay,
        hi: "\(displayTempF(hiF, cfg.tempUnit))°",
        lo: "\(displayTempF(loF, cfg.tempUnit))°",
        wind: "\(degToCompass(obs?.windDirection.value)) "
            + "\(displayWind(windToKph(obs?.windSpeed), cfg.windUnit)) "
            + "\(windUnitLabel(cfg.windUnit))",
        humidity: humidity != nil ? "\(Int(humidity!.rounded()))%" : "--%",
        updated: timeString(),
        alertEvent: topAlert?.properties.event,
        alertColor: topAlert != nil ? alertColor(topAlert!.properties.severity) : "#ff7a3d",
        nowcast: nil,            // radar nowcast isn't ported to Swift…
        nowcastBars: nil,        // …carried forward from the app snapshot in getTimeline
        nowcastNowIdx: nil
    )
}

private func timeString() -> String {
    let f = DateFormatter()
    f.dateFormat = "h:mm a"
    return f.string(from: Date())
}

// MARK: - Condition parsing (mirrors weather/condition.ts)

private struct Cond { let code: String; let isDay: Bool }

private func tokenFromIcon(_ icon: String?) -> (token: String?, isDay: Bool?) {
    guard let icon = icon, let range = icon.range(of: "/icons/land/") else { return (nil, nil) }
    let parts = icon[range.upperBound...].split(separator: "/")
    guard parts.count >= 2 else { return (nil, nil) }
    let dayNight = String(parts[0]).lowercased()
    let token = String(parts[1].prefix(while: { $0.isLetter || $0 == "_" })).lowercased()
    return (token.isEmpty ? nil : token, dayNight == "day")
}

private func codeFromToken(_ token: String) -> String? {
    if token.contains("tsra") { return "tstorm" }
    if token.contains("blizzard") { return "snow" }
    if token.hasPrefix("snow") || token == "snow" { return "snow" }
    if token.contains("sleet") || token.contains("fzra") || token.contains("ip") { return "sleet" }
    if token.contains("rain_showers") || token.contains("shra") { return "showers" }
    if token.contains("rain") { return "rain" }
    if token.contains("fog") || token.contains("haze") || token.contains("smoke") { return "fog" }
    if token.contains("wind") { return "wind" }
    if token == "ovc" { return "overcast" }
    if token == "bkn" { return "cloudy" }
    if token == "sct" || token == "few" { return "partly" }
    if token == "skc" || token == "clear" { return "clear" }
    if token == "hot" { return "hot" }
    if token == "cold" { return "cold" }
    return nil
}

private func codeFromText(_ text: String) -> String {
    let t = text.lowercased()
    if t.contains("thunder") || t.contains("tstorm") { return "tstorm" }
    if t.contains("snow") || t.contains("flurr") || t.contains("blizzard") { return "snow" }
    if t.contains("sleet") || t.contains("freezing") || t.contains("ice") { return "sleet" }
    if t.contains("shower") { return "showers" }
    if t.contains("drizzle") { return "drizzle" }
    if t.contains("rain") { return "rain" }
    if t.contains("fog") || t.contains("haze") || t.contains("smoke") || t.contains("mist") { return "fog" }
    if t.contains("wind") || t.contains("breezy") { return "wind" }
    if t.contains("overcast") { return "overcast" }
    if t.contains("cloud") {
        if t.contains("partly") || t.contains("mostly sunny") || t.contains("few") { return "partly" }
        return "cloudy"
    }
    if t.contains("sunny") || t.contains("clear") {
        return (t.contains("partly") || t.contains("mostly")) ? "partly" : "clear"
    }
    return "partly"
}

private func parseCondition(_ shortForecast: String, _ icon: String?) -> Cond {
    let (token, isDay) = tokenFromIcon(icon)
    let code = token.flatMap(codeFromToken) ?? codeFromText(shortForecast)
    return Cond(code: code, isDay: isDay ?? true)
}

// MARK: - Units (mirrors format/units.ts) + alert color/severity

private func cToF(_ c: Double) -> Double { c * 9 / 5 + 32 }

private func displayTemp(_ c: Double?, _ unit: String) -> String {
    guard let c = c, !c.isNaN else { return "--" }
    return "\(Int((unit == "F" ? cToF(c) : c).rounded()))"
}
private func displayTempF(_ f: Double?, _ unit: String) -> String {
    guard let f = f, !f.isNaN else { return "--" }
    return "\(Int((unit == "C" ? (f - 32) * 5 / 9 : f).rounded()))"
}
private func displayWind(_ kph: Double?, _ unit: String) -> String {
    guard let kph = kph, !kph.isNaN else { return "--" }
    switch unit {
    case "mph": return "\(Int((kph / 1.609).rounded()))"
    case "ms": return "\(Int((kph / 3.6).rounded()))"
    case "kn": return "\(Int((kph / 1.852).rounded()))"
    default: return "\(Int(kph.rounded()))"
    }
}
private func windUnitLabel(_ unit: String) -> String { unit == "kmh" ? "km/h" : unit }

private let COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                       "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
private func degToCompass(_ deg: Double?) -> String {
    guard let deg = deg, !deg.isNaN else { return "--" }
    return COMPASS[((Int((deg / 22.5).rounded()) % 16) + 16) % 16]
}

private func alertColor(_ s: String?) -> String {
    switch s {
    case "Extreme": return "#ff3b54"
    case "Severe": return "#ff7a3d"
    case "Moderate": return "#ffb020"
    case "Minor": return "#ffd84d"
    default: return "#8aa0c8"
    }
}
private func severityRank(_ s: String?) -> Int {
    switch s {
    case "Extreme": return 0
    case "Severe": return 1
    case "Moderate": return 2
    case "Minor": return 3
    default: return 4
    }
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
        WeatherEntry(date: Date(), weather: loadWeather())
    }
    func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> Void) {
        completion(WeatherEntry(date: Date(), weather: loadWeather()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherEntry>) -> Void) {
        let cached = loadWeather()
        // No location written yet (app never opened) → show whatever we have,
        // try again soon.
        guard let cfg = loadConfig() else {
            let entry = WeatherEntry(date: Date(), weather: cached)
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(900))))
            return
        }
        // Option (a): the widget fetches its own fresh data on each OS-scheduled
        // timeline reload, falling back to the last snapshot on failure.
        Task {
            var fresh = await fetchWidgetWeather(cfg)
            // Swift can't recompute the radar nowcast, so keep the precip chart +
            // nowcast line from the last app snapshot atop the fresh NWS fields.
            if fresh != nil {
                fresh!.nowcast = cached?.nowcast
                fresh!.nowcastBars = cached?.nowcastBars
                fresh!.nowcastNowIdx = cached?.nowcastNowIdx
                saveWeather(fresh!)
            }
            let entry = WeatherEntry(date: Date(), weather: fresh ?? cached)
            // iOS budgets these; ~30 min on success, retry sooner on failure.
            let secs: TimeInterval = fresh != nil ? 1800 : 900
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(secs))))
        }
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

/// Bar chart of next-2h precip, drawn to match the Android Canvas version:
/// bars before "now" are dimmed, now-onward solid blue, a dot marks "now".
private struct PrecipChart: View {
    let bars: [Int]
    let nowIdx: Int
    var body: some View {
        Canvas { ctx, size in
            let n = bars.count
            guard n > 0 else { return }
            let gap: CGFloat = n > 24 ? 2 : 3
            let barW = max(1, (size.width - gap * CGFloat(n - 1)) / CGFloat(n))
            let radius = min(barW / 2, 3)
            let botPad: CGFloat = nowIdx >= 0 ? 7 : 2
            let maxH = size.height - 3 - botPad
            for i in 0..<n {
                let v = CGFloat(min(max(bars[i], 0), 100))
                let bh = max(3, v / 100 * maxH)
                let x = CGFloat(i) * (barW + gap)
                let rect = CGRect(x: x, y: size.height - botPad - bh, width: barW, height: bh)
                let isFuture = nowIdx < 0 || i >= nowIdx
                ctx.fill(Path(roundedRect: rect, cornerRadius: radius),
                         with: .color(blue.opacity(isFuture ? 1.0 : 0.4)))
            }
            if nowIdx >= 0 && nowIdx < n {
                let cx = CGFloat(nowIdx) * (barW + gap) + barW / 2
                let dot = CGRect(x: cx - 2.5, y: size.height - botPad + 1.5, width: 5, height: 5)
                ctx.fill(Path(ellipseIn: dot), with: .color(fg))
            }
        }
    }
}

struct MediumView: View {
    let w: WidgetWeather?
    var body: some View {
        Group {
            if let w {
                if let bars = w.nowcastBars, !bars.isEmpty {
                    RainMediumView(w: w, bars: bars)
                } else {
                    NormalMediumView(w: w)
                }
            } else {
                Text("Open Skyfield to set a location")
                    .font(.system(size: 13)).foregroundColor(fg.opacity(0.7))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}

private struct NormalMediumView: View {
    let w: WidgetWeather
    var body: some View {
        HStack(alignment: .center) {
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
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 16).padding(.vertical, 10)
    }
}

/// Rain state: line 1 = place · condition · H/L; line 2 = icon + temp + chart.
/// (No ⟳ — iOS widgets refresh on the WidgetKit timeline, not a tap target.)
private struct RainMediumView: View {
    let w: WidgetWeather
    let bars: [Int]
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(w.place).font(.system(size: 13, weight: .bold)).foregroundColor(fg).lineLimit(1)
                Text("·").font(.system(size: 12)).foregroundColor(fg.opacity(0.5))
                conditionText
                Spacer(minLength: 4)
                Text("H \(w.hi)").font(.system(size: 12, weight: .bold)).foregroundColor(fg)
                Text("L \(w.lo)").font(.system(size: 12, weight: .bold)).foregroundColor(blue)
            }
            HStack(spacing: 8) {
                Image(systemName: symbol(w.code, w.isDay)).font(.system(size: 32)).symbolRenderingMode(.multicolor)
                Text(w.temp).font(.system(size: 36, weight: .light)).foregroundColor(accent)
                PrecipChart(bars: bars, nowIdx: w.nowcastNowIdx ?? -1)
                    .padding(.leading, 8)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 16).padding(.vertical, 10)
    }

    /// Same priority as the Android sub line: alert > nowcast phrase > condition.
    @ViewBuilder private var conditionText: some View {
        if let alert = w.alertEvent {
            Text("⚠ \(alert)").font(.system(size: 12, weight: .bold)).foregroundColor(hexColor(w.alertColor)).lineLimit(1)
        } else if let nc = w.nowcast {
            Text(nc).font(.system(size: 12, weight: .bold)).foregroundColor(Color(red: 0.5, green: 0.83, blue: 1.0)).lineLimit(1)
        } else {
            Text(w.condition).font(.system(size: 12)).foregroundColor(fg.opacity(0.75)).lineLimit(1)
        }
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
