class SolanaMonitor {
    constructor() {
        this.coinId = 'solana';
        this.apiBaseUrl = 'https://api.coingecko.com/api/v3';
        this.priceHistory = [];
        this.maxHistoryPoints = 100;
        this.updateInterval = 30000; // 30 segundos
        this.chart = null;
        this.init();
    }

    async init() {
        await this.fetchInitialData();
        this.setupChart();
        this.startAutoUpdate();
        this.setupEventListeners();
    }

    async fetchInitialData() {
        try {
            await this.fetchPriceData();
            await this.fetchHistoricalData();
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

    async fetchHistoricalData() {
        try {
            const days = 1;
            const response = await fetch(
                `${this.apiBaseUrl}/coins/${this.coinId}/market_chart?vs_currency=usd&days=${days}&interval=hourly`
            );

            if (!response.ok) {
                throw new Error(`API retornou status ${response.status}`);
            }

            const data = await response.json();
            this.priceHistory = data.prices.map(point => ({
                timestamp: point[0],
                price: point[1]
            }));

            this.updateChart();
        } catch (error) {
            console.error('Erro ao buscar dados históricos:', error);
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

        // Atualizar ícone
        if (data.image && data.image.large) {
            document.getElementById('crypto-icon').src = data.image.large;
        }

        // Atualizar timestamp
        const now = new Date();
        document.getElementById('lastUpdate').textContent = now.toLocaleString('pt-BR');

        // Adicionar ao histórico
        this.addToHistory(price);
    }

    addToHistory(price) {
        const timestamp = Date.now();
        this.priceHistory.push({ timestamp, price });

        if (this.priceHistory.length > this.maxHistoryPoints) {
            this.priceHistory.shift();
        }

        this.updateChart();
    }

    setupChart() {
        const ctx = document.getElementById('priceChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'SOL/USDT Price',
                    data: [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.4
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
                        callbacks: {
                            label: function(context) {
                                return `$${context.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'minute',
                            tooltipFormat: 'HH:mm:ss'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                },
                animation: {
                    duration: 0
                }
            }
        });
    }

    updateChart() {
        if (!this.chart) return;

        const labels = this.priceHistory.map(point => new Date(point.timestamp));
        const data = this.priceHistory.map(point => point.price);

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        this.chart.update();
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
        
        statusElement.className = '';
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
            } catch (error) {
                console.error('Erro na atualização automática:', error);
            }
        }, this.updateInterval);
    }

    setupEventListeners() {
        // Adicionar botão de atualização manual
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
                alert('Dados atualizados com sucesso!');
            } catch (error) {
                alert('Erro ao atualizar dados: ' + error.message);
            }
        };

        document.body.appendChild(refreshBtn);
    }
}

// Inicializar aplicativo quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new SolanaMonitor();
});
