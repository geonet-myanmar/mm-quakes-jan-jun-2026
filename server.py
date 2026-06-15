import http.server
import socketserver
import webbrowser
import sys
import threading
import time

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler

class QuietHandler(Handler):
    # Overriding log_message to suppress spamming console logs
    def log_message(self, format, *args):
        pass

def open_browser():
    time.sleep(1.5) # Wait for server to start
    print(f"\n[Dashboard] Launching dashboard at http://localhost:{PORT}")
    webbrowser.open(f"http://localhost:{PORT}")

def run_server():
    # Allow address reuse to prevent "Address already in use" errors on restarts
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), QuietHandler) as httpd:
            print(f"[Dashboard] Local server running at http://localhost:{PORT}")
            print("[Dashboard] Press Ctrl+C in the terminal to stop the server.")
            
            # Start browser in a background thread
            threading.Thread(target=open_browser, daemon=True).start()
            
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Dashboard] Server stopped.")
        sys.exit(0)
    except Exception as e:
        print(f"[Dashboard] Error starting server: {e}")

if __name__ == '__main__':
    run_server()
