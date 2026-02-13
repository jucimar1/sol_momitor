class SolanaMonitor {
    constructor() {
        this.coinId = 'solana';
        this.apiBaseUrl = 'https://api.coingecko.com/api/v3';
        this.priceHistory = {};
        this.currentTimeframe = '15m';
        this.updateInterval = 30000; // 30 segundos
        this.chart = null;
        this.timeframeConfig = {
            '15m': { days: 1, interval: '5min', label: '15 Minutos', timeUnit: 'minute' },
            '4h': { days: 1, interval: '30min', label: '4 Horas', timeUnit: 'hour' },
            '24h': { days: 1, interval: 'hourly', label: '24 Horas', timeUnit: 'hour' },
            '7d': { days: 7, interval: 'daily', label: '7 Dias', timeUnit: 'day' },
            '30d': { days: 30, interval: 'daily', label: '30 Dias', timeUnit: 'day' }
        };
        this.init();
    }

    async init() {
        await this.fetchInitialData();
        this.setupChart();
        this.setupTimeframeButtons();
        this.startAutoUpdate();
        this.setupEventListeners();
    }

    async fetchInitialData() {
        try {
            await this.fetchPriceData();
            await this.fetchAllTimeframes();
        } catch (error) {
            console.error('Erro ao buscar dados iniciais:', error);
            this.updateStatus('Erro ao conectar API', 'error');
        }
    }

    async fetchPriceData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/coins/${this.coinId}`);
            if (!response.ok) {
                throw new Error(`API retornou status ${response.status}`);
            }

            const data = await response.json();
            this.updateUI(data);
            this.updateStatus('Conectado', 'success');
            return data;
        } catch (error) {
            console.error('Erro ao buscar dados de preço:', error);
            this.updateStatus('Erro na API', 'error');
            throw error;
        }
    }

    async fetchAllTimeframes() {
        for (const timeframe of Object.keys(this.timeframeConfig)) {
            try {
                await this.fetchHistoricalData(timeframe);
            } catch (error) {
                console.error(`Erro ao buscar dados para ${timeframe}:`, error);
            }
        }
    }

    async fetchHistoricalData(timeframe) {
        try {
            const config = this.timeframeConfig[timeframe];
            const response = await fetch(
                `${this.apiBaseUrl}/coins/${this.coinId}/market_chart?vs_currency=usd&days=${config.days}&interval=${config.interval}`
            );

            if (!response.ok) {
                throw new Error(`API retornou status ${response.status}`);
            }

            const data = await response.json();
            this.priceHistory[timeframe] = data.prices.map(point => ({
                timestamp: point[0],
                price: point[1]
            }));

            // Se for o timeframe atual, atualiza o gráfico
            if (timeframe === this.currentTimeframe) {
                this.updateChart();
            }

            return this.priceHistory[timeframe];
        } catch (error) {
            console.error(`Erro ao buscar dados históricos para ${timeframe}:`, error);
            throw error;
        }
    }

    updateUI(data) {
        const price = data.market_data.current_price.usd;
        const priceChange = data.market_data.price_change_percentage_24h;
        const high24h = data.market_data.high_24h.usd;
        const low24h = data.market_data.low_24h.usd;
        const volume24h = data.market_data.total_volume.usd;
        const marketCap = data.market_data.market_cap.usd;

        // Atualizar preço atual
        document.getElementById('currentPrice').textContent = `$${price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // Atualizar variação
        const priceChangeElement = document.getElementById('priceChange');
        priceChangeElement.textContent = `${priceChange.toFixed(2)}%`;
        priceChangeElement.className = `price-change ${priceChange >= 0 ? 'positive' : 'negative'}`;

        // Atualizar detalhes
        document.getElementById('high24h').textContent = `$${high24h.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('low24h').textContent = `$${low24h.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('volume24h').textContent = `$${this.formatLargeNumber(volume24h)}`;
        document.getElementById('marketCap').textContent = `$${this.formatLargeNumber(marketCap)}`;

        // Atualizar volume stat
        document.getElementById('volumeStat').textContent = `$${this.formatLargeNumber(volume24h)}`;

        // Atualizar ícone
        if (data.image && data.image.large) {
            document.getElementById('crypto-icon').src = data.image.large;
        }

        // Atualizar timestamp
        const now = new Date();
        document.getElementById('lastUpdate').textContent = now.toLocaleString('pt-BR');

        // Atualizar estatísticas do gráfico atual
        this.updateChartStats();
    }

    setupChart() {
        const ctx = document.getElementById('priceChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
             {
                labels: [],
                datasets: [{
                    label: 'SOL/USDT Price',
                     [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#667eea',
                    pointHoverBorderColor: 'white',
                    pointHoverBorderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    stepped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#333',
                        bodyColor: '#666',
                        borderColor: '#e0e0e0',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return `$${context.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
                            },
                            title: function(tooltipItems) {
                                const date = new Date(tooltipItems[0].parsed.x);
                                return date.toLocaleString('pt-BR');
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'minute',
                            tooltipFormat: 'dd/MM HH:mm:ss',
                            displayFormats: {
                                minute: 'HH:mm',
                                hour: 'dd/MM HH:mm',
                                day: 'dd/MM'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            maxTicksLimit: 10,
                            color: '#666'
                        },
                        border: {
                            color: '#e0e0e0'
                        }
                    },
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            color: '#666',
                            callback: function(value) {
                                return '$' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            }
                        },
                        border: {
                            color: '#e0e0e0'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    setupTimeframeButtons() {
        const buttons = document.querySelectorAll('.timeframe-btn');
        buttons.forEach(button => {
            button.addEventListener('click', async (e) => {
                // Remover classe active de todos
                buttons.forEach(btn => btn.classList.remove('active'));
                
                // Adicionar classe active ao botão clicado
                e.target.classList.add('active');
                
                // Obter timeframe selecionado
                this.currentTimeframe = e.target.dataset.timeframe;
                
                // Atualizar título do gráfico
                document.getElementById('chartTitle').textContent = `Gráfico - Últimos ${this.timeframeConfig[this.currentTimeframe].label}`;
                
                // Buscar dados se necessário
                if (!this.priceHistory[this.currentTimeframe] || this.priceHistory[this.currentTimeframe].length === 0) {
                    await this.fetchHistoricalData(this.currentTimeframe);
                } else {
                    this.updateChart();
                }
                
                // Atualizar estatísticas
                this.updateChartStats();
            });
        });
    }

    updateChart() {
        if (!this.chart || !this.priceHistory[this.currentTimeframe]) return;

        const config = this.timeframeConfig[this.currentTimeframe];
        const data = this.priceHistory[this.currentTimeframe];

        if (data.length === 0) return;

        const labels = data.map(point => new Date(point.timestamp));
        const prices = data.map(point => point.price);

        // Atualizar dados do gráfico
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = prices;

        // Atualizar configuração do eixo X
        this.chart.options.scales.x.time.unit = config.timeUnit;

        // Atualizar gráfico
        this.chart.update('none');
    }

    updateChartStats() {
        if (!this.priceHistory[this.currentTimeframe]) return;

        const data = this.priceHistory[this.currentTimeframe];
        if (data.length === 0) return;

        const prices = data.map(point => point.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const firstPrice = prices[0];
        const lastPrice = prices[prices.length - 1];
        const change = ((lastPrice - firstPrice) / firstPrice) * 100;

        document.getElementById('chartMin').textContent = `Min: $${minPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('chartMax').textContent = `Max: $${maxPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const changeElement = document.getElementById('chartChange');
        changeElement.textContent = `Variação: ${change.toFixed(2)}%`;
        changeElement.className = `chartChange ${change >= 0 ? 'positive' : 'negative'}`;
    }

    formatLargeNumber(num) {
        if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return num.toFixed(2);
    }

    updateStatus(message, type) {
        const statusElement = document.getElementById('apiStatus');
        statusElement.textContent = message;
        
        if (type === 'success') {
            statusElement.style.color = '#00cc00';
        } else if (type === 'error') {
            statusElement.style.color = '#cc0000';
        }
    }

    startAutoUpdate() {
        setInterval(async () => {
            try {
                await this.fetchPriceData();
                
                // Atualizar dados do timeframe atual a cada 5 minutos
                if (Math.random() < 0.2) { // 20% de chance a cada 30s = ~5min
                    await this.fetchHistoricalData(this.currentTimeframe);
                }
            } catch (error) {
                console.error('Erro na atualização automática:', error);
            }
        }, this.updateInterval);
    }

    setupEventListeners() {
        // Botão de atualização manual
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄 Atualizar Agora';
        refreshBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 24px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 50px;
            font-size: 16px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            transition: all 0.3s;
            z-index: 1000;
        `;
        refreshBtn.onmouseover = () => {
            refreshBtn.style.transform = 'scale(1.05)';
            refreshBtn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
        };
        refreshBtn.onmouseout = () => {
            refreshBtn.style.transform = 'scale(1)';
        };
        refreshBtn.onclick = async () => {
            try {
                await this.fetchPriceData();
                await this.fetchHistoricalData(this.currentTimeframe);
                alert('✅ Dados atualizados com sucesso!');
            } catch (error) {
                alert('❌ Erro ao atualizar dados: ' + error.message);
            }
        };

        document.body.appendChild(refreshBtn);

        // Atualizar dados ao voltar para a aba
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                await this.fetchPriceData();
                await this.fetchHistoricalData(this.currentTimeframe);
            }
        });
    }
}

// Inicializar aplicativo quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new SolanaMonitor();
});
