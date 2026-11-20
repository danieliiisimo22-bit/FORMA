import AppKit
import Network
import WebKit

private let port: UInt16 = 56143
private let origin = "http://127.0.0.1:\(port)"

final class StudioServer {
    private let listener: NWListener
    private let assets: [String: (Data, String)]
    private let queue = DispatchQueue(label: "art.forma.studio.http")

    init(resources: URL) throws {
        let files = FileManager.default
        let assetPaths = try files.contentsOfDirectory(atPath: resources.appendingPathComponent("assets").path)
            .map { "assets/" + $0 }
        let paths = ["index.html", "forma.svg", "third-party-licenses.txt"] + assetPaths
        var assets: [String: (Data, String)] = [:]
        for path in paths {
            let url = resources.appendingPathComponent(path)
            let mime: String
            switch url.pathExtension {
            case "html": mime = "text/html; charset=utf-8"
            case "js": mime = "text/javascript; charset=utf-8"
            case "css": mime = "text/css; charset=utf-8"
            case "svg": mime = "image/svg+xml"
            default: mime = "text/plain; charset=utf-8"
            }
            assets["/" + path] = (try Data(contentsOf: url), mime)
        }
        assets["/"] = assets["/index.html"]
        self.assets = assets
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: port)!)
        listener = try NWListener(using: parameters)
    }

    func start(onState: @escaping (NWListener.State) -> Void) {
        listener.stateUpdateHandler = { state in DispatchQueue.main.async { onState(state) } }
        listener.newConnectionHandler = { [weak self] connection in
            guard let self else { connection.cancel(); return }
            connection.start(queue: queue)
            queue.asyncAfter(deadline: .now() + 5) { connection.cancel() }
            receive(connection, data: Data())
        }
        listener.start(queue: queue)
    }

    private func receive(_ connection: NWConnection, data: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 4096) { [weak self] chunk, _, complete, error in
            guard let self, error == nil, let chunk else { connection.cancel(); return }
            let buffer = data + chunk
            guard buffer.count <= 16_384 else { connection.cancel(); return }
            if let end = buffer.range(of: Data("\r\n\r\n".utf8)) {
                send(connection, request: String(decoding: buffer[..<end.lowerBound], as: UTF8.self))
            } else if complete {
                connection.cancel()
            } else {
                receive(connection, data: buffer)
            }
        }
    }

    private func send(_ connection: NWConnection, request: String) {
        let lines = request.components(separatedBy: "\r\n")
        let first = lines[0].split(separator: " ")
        let validHost = lines.dropFirst().contains {
            $0.lowercased().trimmingCharacters(in: .whitespaces) == "host: 127.0.0.1:\(port)"
        }
        let path = first.count == 3 && first[0] == "GET" && validHost ? String(first[1]) : ""
        let resource = assets[path]
        let (body, mime) = resource ?? (Data("Not found".utf8), "text/plain")
        let status = resource == nil ? "404 Not Found" : "200 OK"
        let headers = [
            "HTTP/1.1 " + status, "Content-Type: " + mime, "Content-Length: \(body.count)",
            "X-Content-Type-Options: nosniff", "Connection: close", "Cache-Control: no-cache",
            "Content-Security-Policy: default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'"
        ].joined(separator: "\r\n") + "\r\n\r\n"
        connection.send(content: Data(headers.utf8) + body, contentContext: .finalMessage, isComplete: true,
                        completion: .contentProcessed { _ in connection.cancel() })
    }
}

final class StudioApp: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var server: StudioServer?
    private let smoke = CommandLine.arguments.contains("--smoke-test")
    private var testDownload: URL?

    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            let web = Bundle.main.resourceURL!.appendingPathComponent("web")
            server = try StudioServer(resources: web)
            server?.start { [weak self] state in
                switch state {
                case .ready: self?.openStudio()
                case .failed(let error): self?.fail("No se pudo iniciar el servidor local. " + error.localizedDescription)
                default: break
                }
            }
        } catch {
            fail("No se pudieron leer los recursos de FORMA. " + error.localizedDescription)
        }
        if smoke {
            DispatchQueue.main.asyncAfter(deadline: .now() + 25) { self.fail("La verificación excedió el tiempo límite.") }
        }
    }

    private func openStudio() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = smoke ? .nonPersistent() : .default()
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1360, height: 860),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "FORMA — Generative Art Studio"
        window.minSize = NSSize(width: 390, height: 420)
        window.contentView = webView
        window.center()
        if !smoke {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
        webView.load(URLRequest(url: URL(string: origin + "/")!))
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = action.request.url
        if action.shouldPerformDownload && url?.scheme == "blob" {
            decisionHandler(.download)
        } else if url?.scheme == "http" && url?.host == "127.0.0.1" && url?.port == Int(port) {
            decisionHandler(action.shouldPerformDownload ? .download : .allow)
        } else {
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.canChooseFiles = !parameters.allowsDirectories
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.urls : nil) }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        if smoke {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("forma-smoke-\(UUID().uuidString).png")
            testDownload = url
            completionHandler(url)
            return
        }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.canCreateDirectories = true
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.url : nil) }
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard smoke, let url = testDownload else { return }
        let bytes = (try? Data(contentsOf: url)) ?? Data()
        try? FileManager.default.removeItem(at: url)
        guard bytes.count > 24, Array(bytes.prefix(8)) == [137, 80, 78, 71, 13, 10, 26, 10],
              Array(bytes[16..<24]) == [0, 0, 0, 120, 0, 0, 0, 80] else {
            fail("La exportación de prueba no produjo un PNG de 120 × 80.")
            return
        }
        print("FORMA: render del lienzo y descarga PNG 120 × 80 verificados en WebKit.")
        exit(EXIT_SUCCESS)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if (error as NSError).code != NSURLErrorCancelled { fail(error.localizedDescription) }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard smoke else { return }
        runSmoke()
    }

    private func runSmoke() {
        webView.callAsyncJavaScript("""
        for (let i = 0; i < 80; i++) {
          const canvas = document.querySelector('.stage-frame canvas');
          if (canvas?.dataset.backend && canvas.width > 10) {
            localStorage.setItem('forma-smoke', 'ok');
            if (localStorage.getItem('forma-smoke') !== 'ok') throw Error('Almacenamiento inaccesible');
            document.querySelector('.export-button').click();
            await new Promise(resolve => setTimeout(resolve, 100));
            const dialog = document.querySelector('dialog');
            const select = dialog.querySelectorAll('select')[1];
            const fields = dialog.querySelectorAll('input[type=number]');
            const change = (element, value) => {
              Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value').set.call(element, value);
              element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
            };
            change(select, 'custom');
            await new Promise(resolve => setTimeout(resolve, 40));
            change(fields[0], '120');
            change(fields[1], '80');
            await new Promise(resolve => setTimeout(resolve, 40));
            dialog.querySelector('button[type=submit]').click();
            return canvas.dataset.backend;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw Error('El lienzo no se renderizó');
        """, arguments: [:], in: nil, in: .page) { result in
            if case .failure(let error) = result { self.fail(error.localizedDescription) }
        }
    }

    private func fail(_ message: String) {
        if smoke {
            FileHandle.standardError.write(Data((message + "\n").utf8))
            exit(EXIT_FAILURE)
        }
        let alert = NSAlert()
        alert.messageText = "FORMA"
        alert.informativeText = message
        alert.runModal()
        if window == nil { NSApp.terminate(nil) }
    }
}

let app = NSApplication.shared
let delegate = StudioApp()
app.delegate = delegate
app.setActivationPolicy(.regular)

let menu = NSMenu()
let appItem = NSMenuItem()
let appMenu = NSMenu()
appMenu.addItem(withTitle: "Salir de FORMA", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
appItem.submenu = appMenu
menu.addItem(appItem)
let editItem = NSMenuItem()
let editMenu = NSMenu(title: "Edición")
editMenu.addItem(withTitle: "Cortar", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
editMenu.addItem(withTitle: "Copiar", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
editMenu.addItem(withTitle: "Pegar", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
editMenu.addItem(withTitle: "Seleccionar todo", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
editItem.submenu = editMenu
menu.addItem(editItem)
app.mainMenu = menu
app.run()
