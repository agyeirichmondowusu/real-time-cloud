import { APIClient } from './api.js';
import { Views } from './views.js';
import { ChartEngine } from './charts.js';

class AppController {
  constructor() {
    this.currentView = 'dashboard';
    this.streamMode = 'interval'; // 'interval' or 'live'
    this.pollingTimer = null;
    this.voiceRecognition = null;
    this.voiceActive = false;
    this.performanceChart = null;
    this.init();
  }

  init() {
    this.setupNavigation();
    this.setupMobileMenu();
    this.renderCurrentView();
    this.startGlobalMetricsPolling();
  }

  setupNavigation() {
    document.querySelectorAll('[data-nav]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = item.getAttribute('data-nav');
        this.switchView(targetView);
      });
    });
  }

  setupMobileMenu() {
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('-translate-x-full');
      });
    }
  }

  switchView(viewName) {
    this.currentView = viewName;
    
    // Update Sidebar Active Indicators
    document.querySelectorAll('[data-nav]').forEach(el => {
      if (el.getAttribute('data-nav') === viewName) {
        el.classList.add('bg-blue-600', 'text-white');
        el.classList.remove('text-slate-600', 'hover:bg-slate-100');
      } else {
        el.classList.remove('bg-blue-600', 'text-white');
        el.classList.add('text-slate-600', 'hover:bg-slate-100');
      }
    });

    this.renderCurrentView();
  }

  renderCurrentView() {
    const container = document.getElementById('main-content');
    
    if (this.pollingTimer) clearInterval(this.pollingTimer);

    switch (this.currentView) {
      case 'dashboard':
      case 'live-monitoring':
        container.innerHTML = Views.renderDashboard();
        this.bindDashboardEvents();
        this.startDashboardPolling();
        break;
      case 'cloud-classification':
        container.innerHTML = Views.renderCloudClassification();
        this.startCloudClassificationPolling();
        break;
      case 'performance-analytics':
        container.innerHTML = Views.renderAnalytics();
        this.performanceChart = ChartEngine.initPerformanceCharts();
        this.startPerformancePolling();
        break;
      case 'prediction-history':
        container.innerHTML = Views.renderHistory();
        this.loadHistoryData();
        break;
      case 'chatbot':
        container.innerHTML = Views.renderChatbot();
        this.bindChatbotEvents();
        break;
      case 'system-logs':
        container.innerHTML = Views.renderLogs();
        this.loadLogsData();
        break;
      case 'settings':
        container.innerHTML = Views.renderSettings();
        break;
      case 'about':
        container.innerHTML = Views.renderAbout();
        break;
      default:
        container.innerHTML = Views.renderDashboard();
    }

    // Refresh Lucide Icons after dynamic rendering
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  bindDashboardEvents() {
    const btnInterval = document.getElementById('btn-mode-interval');
    const btnLive = document.getElementById('btn-mode-live');

    if (btnInterval && btnLive) {
      btnInterval.addEventListener('click', () => this.setStreamMode('interval'));
      btnLive.addEventListener('click', () => this.setStreamMode('live'));
    }
  }

  async startCloudClassificationPolling() {
    await this.pollCloudClassificationData();
    this.pollingTimer = setInterval(() => this.pollCloudClassificationData(), 2000);
  }

  async pollCloudClassificationData() {
    try {
      const mbData = await APIClient.getJSON('/api/telemetry/mobilenet');
      if (!mbData) return;

      const primaryClassEl = document.getElementById('cloud-primary-class');
      const categoryEl = document.getElementById('cloud-category');
      const confidenceEl = document.getElementById('cloud-confidence');
      const updatedAtEl = document.getElementById('cloud-updated-at');
      const listContainer = document.getElementById('cloud-class-list');

      if (primaryClassEl) primaryClassEl.innerText = mbData.primary_prediction;
      if (categoryEl) categoryEl.innerText = mbData.category;
      if (confidenceEl) confidenceEl.innerText = `${mbData.confidence}%`;
      if (updatedAtEl) updatedAtEl.innerText = mbData.timestamp;

      if (listContainer && mbData.all_predictions) {
        const sortedPredictions = [...mbData.all_predictions].sort((a, b) => b.confidence - a.confidence);
        const topPredictionType = sortedPredictions[0]?.type;

        listContainer.innerHTML = sortedPredictions.map(pred => {
          const width = Math.max(2, Math.min(pred.confidence, 100));
          const isTop = pred.type === topPredictionType;
          const color = pred.type === 'Cirrus' ? 'bg-sky-400' : pred.type === 'Cumulonimbus' ? 'bg-orange-500' : pred.type === 'Stratus' ? 'bg-indigo-500' : pred.type === 'Cumulus' ? 'bg-emerald-500' : 'bg-slate-400';
          const outer = isTop ? 'border-blue-500 shadow-lg bg-slate-50' : 'border-slate-200 bg-white';
          const titleClass = isTop ? 'font-extrabold text-slate-900 text-lg' : 'font-bold text-slate-900';
          const badge = isTop ? '<span class="text-xs text-blue-600 font-semibold uppercase">Top</span>' : '';

          return `
            <div class="space-y-2 p-4 rounded-3xl border ${outer}">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="${titleClass}">${pred.type}</h4>
                    ${badge}
                  </div>
                  <p class="text-xs text-slate-500 uppercase tracking-[0.2em]">${pred.category}</p>
                </div>
                <span class="text-sm font-semibold ${isTop ? 'text-blue-700' : 'text-slate-800'}">${pred.confidence}%</span>
              </div>
              <div class="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div class="h-full rounded-full ${color} ${isTop ? 'shadow-lg' : ''}" style="width: ${width}%;"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    } catch (error) {
      console.error('[CloudClassification] pollCloudClassificationData failed:', error);
    }
  }

  async startPerformancePolling() {
    if (!this.performanceChart) return;
    await this.updatePerformanceChart();
    this.pollingTimer = setInterval(() => this.updatePerformanceChart(), 2000);
  }

  async updatePerformanceChart() {
    const metrics = await APIClient.getJSON('/api/system');
    if (!metrics || !this.performanceChart) return;

    const option = this.performanceChart.getOption();
    const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const categories = option.xAxis[0].data || [];
    const latencyData = option.series[0].data || [];
    const fpsData = option.series[1].data || [];
    const cpuData = option.series[2].data || [];

    categories.push(now);
    latencyData.push(metrics.avg_inference_ms);
    fpsData.push(metrics.fps);
    cpuData.push(metrics.cpu_usage_pct);

    if (categories.length > 20) {
      categories.shift();
      latencyData.shift();
      fpsData.shift();
      cpuData.shift();
    }

    this.performanceChart.setOption({
      xAxis: [{ data: categories }],
      series: [
        { data: latencyData },
        { data: fpsData },
        { data: cpuData }
      ]
    });
  }

  bindChatbotEvents() {
    const chatForm = document.getElementById('chatbot-form');
    const voiceButton = document.getElementById('chatbot-voice-toggle');

    if (chatForm) {
      chatForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await this.handleChatSubmission();
      });
    }

    if (voiceButton) {
      voiceButton.addEventListener('click', () => this.toggleVoiceRecognition());
    }
  }

  async handleChatSubmission() {
    const input = document.getElementById('chatbot-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    this.appendChatMessage('user', message);
    input.value = '';

    const response = await APIClient.postJSON('/api/chat', { message });
    const reply = response?.reply || 'I could not process that request right now.';
    this.appendChatMessage('assistant', reply);

    if (response?.status === 'success') {
      this.speakChatReply(reply);
    }
  }

  appendChatMessage(role, text) {
    const messageList = document.getElementById('chatbot-message-list');
    const feed = messageList || document.getElementById('chatbot-feed');
    if (!feed) return;

    const bubbleClass = role === 'assistant'
      ? 'self-start bg-slate-900 text-white border border-slate-700'
      : 'self-end bg-blue-600 text-white border border-blue-500';

    const bubble = document.createElement('div');
    bubble.className = `${bubbleClass} p-4 rounded-3xl max-w-[90%] shadow-lg shadow-slate-200/10`;
    bubble.innerHTML = `<p class="text-sm leading-relaxed">${text}</p>`;
    feed.appendChild(bubble);
    feed.scrollTop = feed.scrollHeight;
  }

  speakChatReply(text) {
    if (!window.speechSynthesis || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }

  toggleVoiceRecognition() {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      alert('Voice commands are not supported in this browser.');
      return;
    }

    if (this.voiceActive) {
      this.stopVoiceRecognition();
    } else {
      this.startVoiceRecognition();
    }
  }

  startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.voiceRecognition = new SpeechRecognition();
    this.voiceRecognition.continuous = false;
    this.voiceRecognition.interimResults = false;
    this.voiceRecognition.lang = 'en-US';

    const indicator = document.getElementById('chatbot-voice-indicator');
    if (indicator) indicator.innerText = 'Listening for voice command...';

    this.voiceRecognition.addEventListener('result', async (event) => {
      const spokenText = event.results[0][0].transcript;
      const input = document.getElementById('chatbot-input');
      if (input) input.value = spokenText;
      await this.handleChatSubmission();
    });

    this.voiceRecognition.addEventListener('end', () => {
      this.voiceActive = false;
      const indicator = document.getElementById('chatbot-voice-indicator');
      if (indicator) indicator.innerText = 'Voice command inactive';
    });

    this.voiceRecognition.addEventListener('error', (event) => {
      console.error('Voice recognition error:', event.error);
      this.voiceActive = false;
      const indicator = document.getElementById('chatbot-voice-indicator');
      if (indicator) indicator.innerText = 'Voice command failed';
    });

    this.voiceActive = true;
    this.voiceRecognition.start();
  }

  stopVoiceRecognition() {
    if (this.voiceRecognition) {
      this.voiceRecognition.stop();
      this.voiceRecognition = null;
    }
    this.voiceActive = false;
    const indicator = document.getElementById('chatbot-voice-indicator');
    if (indicator) indicator.innerText = 'Voice command inactive';
  }

  setStreamMode(mode) {
    this.streamMode = mode;
    const btnInterval = document.getElementById('btn-mode-interval');
    const btnLive = document.getElementById('btn-mode-live');
    const rawFeedImg = document.getElementById('raw-feed-img');
    const unetFeedImg = document.getElementById('unet-feed-img');

    if (mode === 'live') {
      btnLive.className = "px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 shadow-sm bg-white text-blue-600";
      btnInterval.className = "px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 transition-all duration-200 hover:text-slate-900";
      
      // Hook endpoints to continuous MJPEG streams
      if (rawFeedImg) rawFeedImg.src = "/video_feed/raw";
      if (unetFeedImg) unetFeedImg.src = "/video_feed/unet";
    } else {
      btnInterval.className = "px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 shadow-sm bg-white text-blue-600";
      btnLive.className = "px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 transition-all duration-200 hover:text-slate-900";
    }

    this.pollInferenceData();
  }

  async startDashboardPolling() {
    this.pollInferenceData();
    this.pollingTimer = setInterval(() => {
      this.pollInferenceData();
    }, 3000);
  }

  async pollInferenceData() {
    try {
      const unetData = await APIClient.getJSON('/api/process/unet');
      const mbData = await APIClient.getJSON('/api/process/mobilenet');

      if (!unetData) {
        console.warn('[Dashboard] UNet data fetch failed.');
      }
      if (!mbData) {
        console.warn('[Dashboard] MobileNet data fetch failed.');
      }

      if (unetData) {
        document.getElementById('unet-coverage').innerText = `${unetData.coverage_percentage}%`;
        const totalPixels = unetData.cloud_pixels + unetData.sky_pixels;
        const skyPercent = totalPixels ? ((unetData.sky_pixels / totalPixels) * 100).toFixed(1) : 0.0;
        document.getElementById('unet-sky-px').innerText = `${skyPercent}%`;
        document.getElementById('unet-oktas').innerText = `${unetData.oktas} / 8`;
        document.getElementById('unet-speed').innerText = `${unetData.inference_time_ms} ms`;
      }

      if (mbData) {
        const primaryClassEl = document.getElementById('mb-primary-class');
        const categoryEl = document.getElementById('mb-category');
        const conf1El = document.getElementById('mb-conf-1');
        const bar1El = document.getElementById('mb-bar-1');

        if (primaryClassEl) primaryClassEl.innerText = mbData.primary_prediction;
        if (categoryEl) categoryEl.innerText = mbData.category;
        if (conf1El) conf1El.innerText = `${mbData.confidence}%`;
        if (bar1El) bar1El.style.width = `${mbData.confidence}%`;

        if (mbData.top_three && mbData.top_three.length >= 3) {
          document.getElementById('mb-conf-2').innerText = `${mbData.top_three[1].confidence}%`;
          document.getElementById('mb-bar-2').style.width = `${mbData.top_three[1].confidence}%`;
          document.getElementById('mb-conf-3').innerText = `${mbData.top_three[2].confidence}%`;
          document.getElementById('mb-bar-3').style.width = `${mbData.top_three[2].confidence}%`;
        }
      }
    } catch (error) {
      console.error('[Dashboard] pollInferenceData failed:', error);
    }
  }

  async startGlobalMetricsPolling() {
    setInterval(async () => {
      const metrics = await APIClient.getJSON('/api/system');
      if (metrics) {
        document.getElementById('hdr-fps').innerText = `${metrics.fps} FPS`;
        document.getElementById('hdr-latency').innerText = `${metrics.avg_inference_ms} ms`;
        document.getElementById('hdr-clock').innerText = metrics.current_time;
      }
    }, 1000);
  }

  async loadPerformanceData(chartInstance) {
    const metrics = await APIClient.getJSON('/api/system');
    if (!metrics || !chartInstance) return;

    const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    chartInstance.addData([now, metrics.avg_inference_ms, metrics.fps, metrics.cpu_usage_pct]);
  }

  async loadHistoryData() {
    const data = await APIClient.getJSON('/api/history');
    const tbody = document.getElementById('history-table-body');
    const exportBtn = document.getElementById('export-history-csv');

    if (data && tbody) {
      tbody.innerHTML = data.history.map(row => `
        <tr class="hover:bg-slate-50 transition">
          <td class="p-4 font-mono text-slate-500">${row.timestamp}</td>
          <td class="p-4 font-bold text-slate-800">${row.cloud_class}</td>
          <td class="p-4 text-emerald-600 font-bold">${row.confidence}%</td>
          <td class="p-4">${row.coverage}%</td>
          <td class="p-4">${row.oktas} / 8</td>
        </tr>
      `).join('');
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        if (!data || !data.history.length) return;
        const csvRows = [
          ['Timestamp', 'Cloud Class', 'Confidence', 'Coverage', 'Oktas']
        ];
        data.history.forEach(row => {
          csvRows.push([row.timestamp, row.cloud_class, row.confidence, row.coverage, row.oktas]);
        });
        const csvContent = csvRows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prediction_history_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'_')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }
  }

  async loadLogsData() {
    const data = await APIClient.getJSON('/api/logs');
    const term = document.getElementById('log-terminal');
    if (data && term) {
      term.innerHTML = data.logs.map(log => `
        <p class="mb-2"><span class="text-slate-500">[${log.time}]</span> <span class="text-blue-400">[${log.source}]</span> ${log.message}</p>
      `).join('');
    }

    const clearButton = document.getElementById('clear-logs-btn');
    if (clearButton) {
      clearButton.addEventListener('click', async () => {
        await APIClient.postJSON('/api/logs/clear', {});
        if (term) term.innerHTML = '<p class="text-slate-400">Logs cleared.</p>';
      });
    }

    // Refresh logs every 2 seconds while the view is active
    if (this.currentView === 'system-logs') {
      setTimeout(() => this.loadLogsData(), 2000);
    }
  }
}


// Initialize Single-Page Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});