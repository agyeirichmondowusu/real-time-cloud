export class ChartEngine {
  static initPerformanceCharts() {
    const chartDom = document.getElementById('latency-chart');
    if (!chartDom) return;

    const myChart = echarts.init(chartDom);
    const option = {
      animation: true,
      grid: { top: 20, right: 20, bottom: 20, left: 40 },
      xAxis: {
        type: 'category',
        data: ['00:00', '00:05', '00:10', '00:15', '00:20', '00:25', '00:30'],
        axisLine: { lineStyle: { color: '#94a3b8' } }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#94a3b8' } },
        splitLine: { lineStyle: { color: '#f1f5f9' } }
      },
      series: [{
        data: [42, 40, 45, 39, 41, 43, 38],
        type: 'line',
        smooth: true,
        lineStyle: { color: '#2563eb', width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(37, 99, 235, 0.25)' },
            { offset: 1, color: 'rgba(37, 99, 235, 0.0)' }
          ])
        }
      }]
    };
    myChart.setOption(option);
    window.addEventListener('resize', () => myChart.resize());
    return myChart;
  }
}