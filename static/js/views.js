export class Views {
  static renderDashboard() {
    return `
      <!-- First Row: Synchronized Spherical Image Panels -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <!-- Left Panel: Spherical ESP32 Frame -->
        <div class="card-glass card-zoom p-6 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h3 class="font-bold text-slate-800 text-xl flex items-center gap-2">
                <i data-lucide="globe" class="w-6 h-6 text-blue-600"></i> Spherical ESP32 Capture
              </h3>
              <span id="raw-stream-badge" class="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-semibold flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Synchronized
              </span>
            </div>

            <!-- Spherical Viewport Container -->
            <div class="relative w-full max-w-[400px] aspect-square mx-auto bg-slate-950 rounded-full overflow-hidden group shadow-2xl border-4 border-slate-800/80">
              <!-- Spherical Image Stream -->
              <img id="raw-feed-img" src="/api/frame/sphere" alt="Spherical ESP32 Stream" class="w-full h-full object-cover rounded-full transition-transform duration-500 group-hover:scale-105" />
              
              <!-- Spherical Coordinate Grid Overlay -->
              <svg class="absolute inset-0 w-full h-full pointer-events-none opacity-40 group-hover:opacity-60 transition-opacity duration-300" viewBox="0 0 100 100">
                <!-- Outer Border Ring -->
                <circle cx="50" cy="50" r="48" fill="none" stroke="#38bdf8" stroke-width="0.8" />
                <!-- Concentric Latitude Rings -->
                <circle cx="50" cy="50" r="34" fill="none" stroke="#38bdf8" stroke-width="0.5" stroke-dasharray="1.5 1.5" />
                <circle cx="50" cy="50" r="18" fill="none" stroke="#38bdf8" stroke-width="0.5" stroke-dasharray="1.5 1.5" />
                <!-- Longitude Axis Lines -->
                <line x1="50" y1="2" x2="50" y2="98" stroke="#38bdf8" stroke-width="0.5" />
                <line x1="2" y1="50" x2="98" y2="50" stroke="#38bdf8" stroke-width="0.5" />
                <line x1="16" y1="16" x2="84" y2="84" stroke="#38bdf8" stroke-width="0.3" stroke-dasharray="1 1" />
                <line x1="84" y1="16" x2="16" y2="84" stroke="#38bdf8" stroke-width="0.3" stroke-dasharray="1 1" />
              </svg>

              <!-- Center Point Crosshair -->
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div class="w-2 h-2 rounded-full border border-sky-400 bg-sky-500/50"></div>
              </div>

              <!-- Stream Metadata Tag -->
              <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/85 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full border border-white/10 font-mono shadow-md whitespace-nowrap">
                360° Spherical • ESP32-CAM
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mt-6 text-sm text-slate-600 font-medium">
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">Timestamp: <span id="raw-time" class="text-slate-900 font-bold font-mono">--:--:--</span></div>
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">Status: <span class="text-emerald-600 font-bold">Active Connection</span></div>
          </div>
        </div>

        <!-- Right Panel: Spherical UNet Mask Segment -->
        <div class="card-glass card-zoom p-6 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h3 class="font-bold text-slate-800 text-xl flex items-center gap-2">
                <i data-lucide="layers" class="w-6 h-6 text-indigo-600"></i> Spherical UNet Mask
              </h3>
              <label class="flex items-center gap-2 text-sm font-semibold cursor-pointer text-slate-600">
                <input type="checkbox" id="overlay-toggle" checked class="w-5 h-5 accent-blue-600 rounded"> Enable Overlay
              </label>
            </div>

            <!-- Spherical Viewport Container -->
            <div class="relative w-full max-w-[400px] aspect-square mx-auto bg-slate-950 rounded-full overflow-hidden group shadow-2xl border-4 border-indigo-950/80">
              <!-- Spherical UNet Output Stream -->
              <img id="unet-feed-img" src="/api/frame/unet" alt="Spherical UNet Output" class="w-full h-full object-cover rounded-full transition-transform duration-500 group-hover:scale-105" />
              
              <!-- Spherical Coordinate Grid Overlay -->
              <svg class="absolute inset-0 w-full h-full pointer-events-none opacity-40 group-hover:opacity-60 transition-opacity duration-300" viewBox="0 0 100 100">
                <!-- Outer Border Ring -->
                <circle cx="50" cy="50" r="48" fill="none" stroke="#818cf8" stroke-width="0.8" />
                <!-- Concentric Latitude Rings -->
                <circle cx="50" cy="50" r="34" fill="none" stroke="#818cf8" stroke-width="0.5" stroke-dasharray="1.5 1.5" />
                <circle cx="50" cy="50" r="18" fill="none" stroke="#818cf8" stroke-width="0.5" stroke-dasharray="1.5 1.5" />
                <!-- Longitude Axis Lines -->
                <line x1="50" y1="2" x2="50" y2="98" stroke="#818cf8" stroke-width="0.5" />
                <line x1="2" y1="50" x2="98" y2="50" stroke="#818cf8" stroke-width="0.5" />
                <line x1="16" y1="16" x2="84" y2="84" stroke="#818cf8" stroke-width="0.3" stroke-dasharray="1 1" />
                <line x1="84" y1="16" x2="16" y2="84" stroke="#818cf8" stroke-width="0.3" stroke-dasharray="1 1" />
              </svg>

              <!-- Center Point Crosshair -->
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div class="w-2 h-2 rounded-full border border-indigo-400 bg-indigo-500/50"></div>
              </div>

              <!-- Stream Metadata Tag -->
              <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-indigo-950/85 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full border border-white/10 font-mono shadow-md whitespace-nowrap">
                Inference: <span id="unet-speed">39.4 ms</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3 mt-6 text-center text-sm font-semibold">
            <div class="bg-blue-50/80 p-3 rounded-xl border border-blue-100 text-blue-900">
              <p class="text-xs text-blue-600 font-bold uppercase">Cloud Coverage</p>
              <p id="unet-coverage" class="text-xl font-extrabold mt-0.5">62.4%</p>
            </div>
            <div class="bg-sky-50/80 p-3 rounded-xl border border-sky-100 text-sky-900">
              <p class="text-xs text-sky-600 font-bold uppercase">Sky Pixels</p>
              <p id="unet-sky-px" class="text-xl font-extrabold mt-0.5">37.6%</p>
            </div>
            <div class="bg-indigo-50/80 p-3 rounded-xl border border-indigo-100 text-indigo-900">
              <p class="text-xs text-indigo-600 font-bold uppercase">Oktas Value</p>
              <p id="unet-oktas" class="text-xl font-extrabold mt-0.5">5 / 8</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Second Row: Full-Width MobileNet Prediction Banner -->
      <div id="mobilenet-card" class="card-glass card-zoom p-8 mb-8 bg-class-altocumulus border-2 transition-all duration-300">
        <div class="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div class="flex items-center gap-6 w-full lg:w-auto">
            <div class="w-20 h-20 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
              <i data-lucide="cloud-sun" class="w-12 h-12"></i>
            </div>
            <div>
              <span class="text-xs font-black uppercase tracking-wider text-blue-700">Primary MobileNet V3 Classifier Result</span>
              <h2 id="mb-primary-class" class="text-4xl font-extrabold text-slate-900 tracking-tight mt-1 whitespace-nowrap">Altocumulus</h2>
              <p class="text-sm text-slate-600 mt-1 font-medium">Categorization: <span id="mb-category" class="font-bold text-slate-800">Mid-Level Cloud Formations (2,000 - 6,000m)</span></p>
            </div>
          </div>

          <!-- Confidence Indicators -->
          <div class="w-full lg:w-1/2 space-y-3">
            <div>
              <div class="flex justify-between text-sm font-bold text-slate-800 mb-1">
                <span>Altocumulus</span>
                <span id="mb-conf-1">88.4%</span>
              </div>
              <div class="w-full h-3 bg-slate-200/80 rounded-full overflow-hidden">
                <div id="mb-bar-1" class="h-full bg-blue-600 rounded-full transition-all duration-500" style="width: 88.4%"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                <span>Cirrostratus</span>
                <span id="mb-conf-2">8.2%</span>
              </div>
              <div class="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                <div id="mb-bar-2" class="h-full bg-slate-400 rounded-full transition-all duration-500" style="width: 8.2%"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                <span>Cumulus</span>
                <span id="mb-conf-3">3.4%</span>
              </div>
              <div class="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                <div id="mb-bar-3" class="h-full bg-slate-300 rounded-full transition-all duration-500" style="width: 3.4%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Third Row: Stream Mode Controller Bar -->
      <div class="card-glass p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <i data-lucide="sliders" class="w-6 h-6 text-slate-600"></i>
          <div>
            <h4 class="font-bold text-slate-800 text-lg">Stream Mode Controller</h4>
            <p class="text-xs text-slate-500">Switch inference delivery pipeline dynamically</p>
          </div>
        </div>
        <div class="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button id="btn-mode-interval" class="px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 shadow-sm bg-white text-blue-600">
            ● 3-Second Interval Snapshots
          </button>
          <button id="btn-mode-live" class="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 transition-all duration-200 hover:text-slate-900">
            ○ Live Continuous MJPEG Stream
          </button>
        </div>
      </div>
    `;
  }

  static renderAnalytics() {
    return `
      <div class="card-glass p-8 mb-8">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <h3 class="text-2xl font-bold text-slate-900">Performance Analytics</h3>
            <p class="text-slate-600 mt-2">Live trend view of inference latency, frame throughput, and CPU load for the edge AI pipeline.</p>
          </div>
          <div class="text-slate-500 text-sm">
            <p class="font-semibold">Live update every 2 seconds</p>
          </div>
        </div>
        <div class="grid gap-4 mb-6 md:grid-cols-3 text-sm text-slate-600">
          <div class="p-4 rounded-3xl bg-slate-50 border border-slate-200">
            <p class="uppercase tracking-[0.2em] text-xs font-semibold text-slate-500">Latency</p>
            <p class="mt-2 text-xl font-bold text-slate-900">Average inference latency in ms</p>
          </div>
          <div class="p-4 rounded-3xl bg-slate-50 border border-slate-200">
            <p class="uppercase tracking-[0.2em] text-xs font-semibold text-slate-500">Throughput</p>
            <p class="mt-2 text-xl font-bold text-slate-900">Frames processed per second</p>
          </div>
          <div class="p-4 rounded-3xl bg-slate-50 border border-slate-200">
            <p class="uppercase tracking-[0.2em] text-xs font-semibold text-slate-500">CPU Load</p>
            <p class="mt-2 text-xl font-bold text-slate-900">Edge system utilization</p>
          </div>
        </div>
        <div id="latency-chart" class="w-full h-96 rounded-3xl overflow-hidden"></div>
      </div>
    `;
  }

  static renderHistory() {
    return `
      <div class="card-glass p-8">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <h3 class="text-2xl font-bold text-slate-900">Prediction History Logs</h3>
            <p class="text-slate-600 mt-2">Recent cloud predictions are stored here with confidence, coverage, and Oktas values.</p>
          </div>
          <div class="flex items-center gap-3 w-full md:w-auto">
            <button id="export-history-csv" class="px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition">Export CSV</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-600">
            <thead class="bg-slate-50 text-slate-800 font-bold uppercase text-xs border-b border-slate-200">
              <tr>
                <th class="p-4">Timestamp</th>
                <th class="p-4">Cloud Class</th>
                <th class="p-4">Confidence</th>
                <th class="p-4">Coverage</th>
                <th class="p-4">Oktas</th>
              </tr>
            </thead>
            <tbody id="history-table-body" class="divide-y divide-slate-100 font-medium">
              <tr><td colspan="5" class="p-4 text-center text-slate-400">Loading historical data...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  static renderChatbot() {
    return `
      <div class="card-glass p-8 space-y-6">
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 class="text-3xl font-extrabold text-slate-900">Cloud AI Assistant</h3>
            <p class="text-slate-600 mt-2 max-w-2xl">Ask the assistant about cloud classification, current model confidence, prediction summaries, or save the latest inference snapshot.</p>
          </div>
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button id="chatbot-voice-toggle" class="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition">🎙 Voice Command</button>
            <span id="chatbot-voice-indicator" class="text-sm text-slate-500">Voice command inactive</span>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-6">
          <div class="bg-slate-950/95 text-slate-100 p-6 rounded-3xl h-[600px] overflow-y-auto shadow-2xl" id="chatbot-feed">
            <div class="space-y-4" id="chatbot-message-list">
              <div class="self-start bg-slate-800 border border-slate-700 p-4 rounded-3xl shadow-sm max-w-[85%]">
                <p class="text-sm leading-relaxed">Hello! I am your cloud assistant. Ask me anything about the current cloud predictions, classification confidence, or inference health.</p>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h4 class="text-lg font-bold text-slate-900 mb-3">Send a message</h4>
              <form id="chatbot-form" class="space-y-4">
                <textarea id="chatbot-input" rows="4" class="w-full px-4 py-3 border border-slate-200 rounded-3xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Type your question or command here..."></textarea>
                <button type="submit" class="w-full py-3 bg-blue-600 text-white font-bold rounded-3xl hover:bg-blue-700 transition">Send Message</button>
              </form>
            </div>
            <div class="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h4 class="text-lg font-bold text-slate-900 mb-3">How to use</h4>
              <ul class="space-y-2 text-slate-600 text-sm">
                <li>• Ask: “What is the current cloud type?”</li>
                <li>• Ask: “Show the top cloud predictions.”</li>
                <li>• Command: “Save the latest frame.”</li>
                <li>• Ask: “What is current inference latency?”</li>
                <li>• Ask: “How confident is the model?”</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static renderCloudClassification() {
    return `
      <div class="card-glass p-8 space-y-8">
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 class="text-3xl font-extrabold text-slate-900">Cloud Classification</h3>
            <p class="text-slate-600 mt-2 max-w-2xl">Live MobileNet predictions with progress bars for every cloud type. The highest-ranked cloud type is highlighted and shown as the current primary result.</p>
          </div>
          <div class="text-sm text-slate-500">
            <p class="font-semibold">Updated every 2 seconds</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-6">
          <div class="card-glass p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div class="mb-6">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-xs uppercase tracking-[0.2em] font-bold text-slate-500">Primary cloud prediction</p>
                  <h2 id="cloud-primary-class" class="text-4xl font-extrabold text-slate-900 mt-2">Unknown</h2>
                  <p class="text-sm text-slate-600 mt-2">Category: <span id="cloud-category" class="font-semibold text-slate-800">Awaiting data...</span></p>
                </div>
                <div class="text-right">
                  <span class="text-sm uppercase tracking-[0.2em] text-slate-500">Confidence</span>
                  <div id="cloud-confidence" class="text-5xl font-extrabold text-slate-900 mt-2">0%</div>
                </div>
              </div>
            </div>

            <div id="cloud-class-list" class="space-y-4">
              <div class="p-4 rounded-3xl bg-slate-50 border border-slate-200">
                <div class="flex items-center justify-between mb-3">
                  <div>
                    <p class="text-sm font-semibold text-slate-900">Loading model probabilities...</p>
                    <p class="text-xs text-slate-500">Each cloud type is shown with its current confidence progress bar.</p>
                  </div>
                  <span class="text-xs text-slate-500">Live</span>
                </div>
                <div class="h-3 bg-slate-200 rounded-full overflow-hidden"><div class="h-full w-1/2 bg-slate-400 rounded-full"></div></div>
              </div>
            </div>
          </div>

          <div class="card-glass p-6 rounded-3xl border border-slate-200 shadow-sm bg-slate-950 text-slate-100">
            <h4 class="text-lg font-bold text-white mb-4">Prediction Details</h4>
            <div class="grid gap-4 text-sm">
              <div class="p-4 rounded-3xl bg-slate-900/80">
                <p class="text-slate-400 uppercase tracking-[0.2em] text-xs">Last updated</p>
                <p id="cloud-updated-at" class="mt-2 text-slate-200 font-semibold">--:--:--</p>
              </div>
              <div class="p-4 rounded-3xl bg-slate-900/80">
                <p class="text-slate-400 uppercase tracking-[0.2em] text-xs">Model status</p>
                <p class="mt-2 text-slate-200 font-semibold">MobileNet V3</p>
              </div>
              <div class="p-4 rounded-3xl bg-slate-900/80">
                <p class="text-slate-400 uppercase tracking-[0.2em] text-xs">Source</p>
                <p class="mt-2 text-slate-200 font-semibold">ESP32 spherical capture</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static renderLogs() {
    return `
      <div class="card-glass p-8">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-2xl font-bold text-slate-900">System Activity Logs</h3>
          <button id="clear-logs-btn" class="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-200">Clear Terminal</button>
        </div>
        <div class="bg-slate-950 text-slate-200 font-mono p-6 rounded-2xl h-96 overflow-y-auto text-xs space-y-2" id="log-terminal">
          <p><span class="text-emerald-400">[SYSTEM]</span> Initializing API connection handlers...</p>
        </div>
      </div>
    `;
  }

  static renderSettings() {
    return `
      <div class="card-glass p-8 max-w-3xl mx-auto">
        <h3 class="text-2xl font-bold text-slate-900 mb-6">System Configuration</h3>
        <form id="settings-form" class="space-y-6">
          <div>
            <label class="block text-sm font-bold text-slate-700 mb-2">Polling Refresh Interval (Seconds)</label>
            <input type="number" id="setting-refresh" value="3" min="1" max="10" class="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 font-bold">
          </div>
          <div>
            <label class="block text-sm font-bold text-slate-700 mb-2">Image Stream Quality</label>
            <select id="setting-quality" class="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 font-bold">
              <option value="high">High (1080p Stream Processing)</option>
              <option value="medium" selected>Medium (720p Native ESP32)</option>
              <option value="low">Low (480p Fast Processing)</option>
            </select>
          </div>
          <button type="submit" class="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition">Save & Apply Changes</button>
        </form>
      </div>
    `;
  }

  static renderAbout() {
    return `
      <div class="card-glass p-8 max-w-4xl mx-auto space-y-6">
        <h2 class="text-3xl font-extrabold text-slate-900">About ESP32 Cloud Observation Platform</h2>
        <p class="text-slate-600">Enterprise edge AI monitoring architecture integrated with UNet image segmentation models and MobileNet cloud classification networks. Designed for high-frequency cloud observational research and autonomous weather reporting.</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200 text-center">
          <div class="bg-slate-50 p-4 rounded-xl"><p class="text-xs text-slate-500 font-bold">PyTorch</p><p class="text-lg font-bold text-slate-800">v2.1.0</p></div>
          <div class="bg-slate-50 p-4 rounded-xl"><p class="text-xs text-slate-500 font-bold">FastAPI</p><p class="text-lg font-bold text-slate-800">v0.104.1</p></div>
          <div class="bg-slate-50 p-4 rounded-xl"><p class="text-xs text-slate-500 font-bold">OpenCV</p><p class="text-lg font-bold text-slate-800">v4.8.1</p></div>
          <div class="bg-slate-50 p-4 rounded-xl"><p class="text-xs text-slate-500 font-bold">ESP32 Firmware</p><p class="text-lg font-bold text-slate-800">v1.0.4</p></div>
        </div>
      </div>
    `;
  }
}