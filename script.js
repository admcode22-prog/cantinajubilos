const App = {
    events: JSON.parse(localStorage.getItem('cantinaEvents')) || {},
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    selectedDay: null,
    vendaEditando: null,
    pagamentoVendaId: null,

    init() {
        this.atualizarHeader();
        this.gerarCalendario();
        
        // Event listeners para cálculos automáticos
        const vendaQtd = document.getElementById('vendaQtd');
        const vendaValorUnit = document.getElementById('vendaValorUnit');
        const vendaValorPago = document.getElementById('vendaValorPago');
        
        if (vendaQtd) vendaQtd.addEventListener('input', () => this.calcularTotalVenda());
        if (vendaValorUnit) vendaValorUnit.addEventListener('input', () => this.calcularTotalVenda());
        if (vendaValorPago) vendaValorPago.addEventListener('input', () => this.calcularPendenteVenda());
        
        if (Object.keys(this.events).length === 0) {
            this.criarDadosExemplo();
        }
    },

    atualizarHeader() {
        const hoje = new Date();
        document.getElementById('headerDate').innerHTML = hoje.toLocaleDateString('pt-BR', {
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
        });
    },

    gerarCalendario() {
        const primeiroDia = new Date(this.currentYear, this.currentMonth, 1);
        const ultimoDia = new Date(this.currentYear, this.currentMonth + 1, 0);
        const diaSemanaInicio = primeiroDia.getDay();
        const totalDias = ultimoDia.getDate();

        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        
        document.getElementById('monthYear').innerHTML = `${meses[this.currentMonth]} ${this.currentYear}`;

        let html = '';
        
        for (let i = 0; i < diaSemanaInicio; i++) {
            html += '<div class="calendar-day" style="opacity: 0.3;"></div>';
        }

        for (let dia = 1; dia <= totalDias; dia++) {
            const dataKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            const temEvento = this.events[dataKey];
            
            html += `
                <div class="calendar-day ${temEvento ? 'has-event' : ''}" onclick="app.abrirDia('${dataKey}')">
                    <div class="day-number">${dia}</div>
                    ${temEvento ? '<div class="event-tag">' + (temEvento.eventName?.substring(0, 5) || 'Evento') + '</div>' : ''}
                </div>
            `;
        }

        document.getElementById('calendarDays').innerHTML = html;
    },

    anteriorMes() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.gerarCalendario();
    },

    proximoMes() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.gerarCalendario();
    },

    // ========== ABRIR DIA ==========
    abrirDia(dataKey) {
        this.selectedDay = dataKey;
        
        if (!this.events[dataKey]) {
            this.events[dataKey] = {
                eventName: '',
                responsible: '',
                notes: '',
                ingredientes: [],
                vendas: []
            };
        }

        const [ano, mes, dia] = dataKey.split('-');
        document.getElementById('selectedDate').innerHTML = `📅 ${dia}/${mes}/${ano}`;
        
        this.carregarDadosEvento();
        
        document.getElementById('calendarSection').classList.add('hidden');
        document.getElementById('managementSection').classList.remove('hidden');
        this.mudarAba('evento');
    },

    // ========== CARREGAR DADOS DO EVENTO ==========
    carregarDadosEvento() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const evento = this.events[this.selectedDay];
        
        // Atualiza o card do evento
        document.getElementById('selectedEventName').innerHTML = evento.eventName || 'Novo Evento';
        document.getElementById('selectedResponsible').innerHTML = `👤 ${evento.responsible || 'Clique para editar'}`;
        
        // Carrega os campos da aba evento
        document.getElementById('eventName').value = evento.eventName || '';
        document.getElementById('responsible').value = evento.responsible || '';
        document.getElementById('notes').value = evento.notes || '';
        
        this.atualizarListaIngredientes();
        this.atualizarListaVendas();
        this.atualizarResumoEvento();
    },

    atualizarResumoEvento() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const evento = this.events[this.selectedDay];
        const ingredientes = evento.ingredientes || [];
        const vendas = evento.vendas || [];
        
        const totalCustos = ingredientes.reduce((acc, item) => acc + (item.doacao ? 0 : item.valorTotal), 0);
        const totalVendas = vendas.reduce((acc, venda) => acc + (venda.quantidade * venda.valorUnit), 0);
        const totalRecebido = vendas.reduce((acc, venda) => acc + (venda.valorPago || 0), 0);
        const aReceber = totalVendas - totalRecebido;
        const lucro = totalVendas - totalCustos;

        document.getElementById('resumoEventoCusto').innerHTML = `R$ ${totalCustos.toFixed(2)}`;
        document.getElementById('resumoEventoVendas').innerHTML = `R$ ${totalVendas.toFixed(2)}`;
        document.getElementById('resumoEventoLucro').innerHTML = `R$ ${lucro.toFixed(2)}`;
        document.getElementById('resumoEventoAReceber').innerHTML = `R$ ${aReceber.toFixed(2)}`;
    },

    // ========== MUDAR ABA ==========
    mudarAba(aba) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(content => content.classList.remove('active'));
        
        if (aba === 'evento') {
            document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
            document.getElementById('tabEvento').classList.add('active');
        } else if (aba === 'custos') {
            document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
            document.getElementById('tabCustos').classList.add('active');
        } else if (aba === 'vendas') {
            document.querySelector('.tab-btn:nth-child(3)').classList.add('active');
            document.getElementById('tabVendas').classList.add('active');
        } else if (aba === 'relatorio') {
            document.querySelector('.tab-btn:nth-child(4)').classList.add('active');
            document.getElementById('tabRelatorio').classList.add('active');
            this.atualizarRelatorioEvento();
        }
    },

    // ========== EVENTO ==========
    salvarEvento() {
        if (!this.selectedDay) return;

        const eventName = document.getElementById('eventName').value;
        const responsible = document.getElementById('responsible').value;
        const notes = document.getElementById('notes').value;

        if (!this.events[this.selectedDay]) {
            this.events[this.selectedDay] = {};
        }

        this.events[this.selectedDay].eventName = eventName;
        this.events[this.selectedDay].responsible = responsible;
        this.events[this.selectedDay].notes = notes;

        // Atualiza o card do evento
        document.getElementById('selectedEventName').innerHTML = eventName || 'Novo Evento';
        document.getElementById('selectedResponsible').innerHTML = `👤 ${responsible || 'Clique para editar'}`;

        this.salvarDados();

        // Feedback visual
        const btn = event.target;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>✅</span> Salvo!';
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 1500);
    },

    // ========== CUSTOS ==========
    mostrarFormIngrediente() {
        document.getElementById('formIngrediente').classList.remove('hidden');
        this.limparFormIngrediente();
    },

    cancelarFormIngrediente() {
        document.getElementById('formIngrediente').classList.add('hidden');
    },

    limparFormIngrediente() {
        document.getElementById('ingredienteNome').value = '';
        document.getElementById('ingredienteQtd').value = '';
        document.getElementById('ingredienteUnidade').value = 'un';
        document.getElementById('ingredienteValor').value = '';
        document.getElementById('ingredienteDoacao').checked = false;
    },

    adicionarIngrediente() {
        if (!this.selectedDay) return;

        const nome = document.getElementById('ingredienteNome').value;
        const quantidade = parseFloat(document.getElementById('ingredienteQtd').value) || 0;
        const unidade = document.getElementById('ingredienteUnidade').value;
        const valorTotal = parseFloat(document.getElementById('ingredienteValor').value) || 0;
        const doacao = document.getElementById('ingredienteDoacao').checked;

        if (!nome) {
            alert('Digite o nome do ingrediente!');
            return;
        }

        if (quantidade <= 0) {
            alert('Digite a quantidade!');
            return;
        }

        if (!doacao && valorTotal <= 0) {
            alert('Digite o valor total!');
            return;
        }

        if (!this.events[this.selectedDay].ingredientes) {
            this.events[this.selectedDay].ingredientes = [];
        }

        this.events[this.selectedDay].ingredientes.push({
            id: Date.now(),
            nome,
            quantidade,
            unidade,
            valorTotal,
            doacao
        });

        this.cancelarFormIngrediente();
        this.atualizarListaIngredientes();
        this.atualizarResumoEvento();
        this.salvarDados();
    },

    atualizarListaIngredientes() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const ingredientes = this.events[this.selectedDay].ingredientes || [];
        let html = '';

        ingredientes.forEach((item, index) => {
            html += `
                <div class="item-card">
                    <div class="item-info">
                        <span class="item-name">${item.nome}</span>
                        <span class="item-details">${item.quantidade} ${item.unidade} • R$ ${item.valorTotal.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        ${item.doacao ? '<span class="item-badge">🎁</span>' : ''}
                        <button class="btn-delete-event" style="background: var(--danger); width: 28px; height: 28px;" onclick="app.removerIngrediente(${index})">🗑️</button>
                    </div>
                </div>
            `;
        });

        document.getElementById('ingredientesList').innerHTML = html || '<div style="text-align: center; padding: 20px; color: var(--text-light);">Nenhum ingrediente</div>';
    },

    removerIngrediente(index) {
        if (confirm('Remover este ingrediente?')) {
            this.events[this.selectedDay].ingredientes.splice(index, 1);
            this.atualizarListaIngredientes();
            this.atualizarResumoEvento();
            this.salvarDados();
        }
    },

    // ========== VENDAS ==========
    mostrarFormVenda() {
        document.getElementById('formVenda').classList.remove('hidden');
        this.limparFormVenda();
    },

    cancelarFormVenda() {
        document.getElementById('formVenda').classList.add('hidden');
        this.vendaEditando = null;
    },

    limparFormVenda() {
        document.getElementById('vendaCliente').value = '';
        document.getElementById('vendaProduto').value = '';
        document.getElementById('vendaQtd').value = '1';
        document.getElementById('vendaValorUnit').value = '';
        document.getElementById('vendaTotal').value = '';
        document.getElementById('vendaFormaPagamento').value = 'dinheiro';
        document.getElementById('vendaValorPago').value = '';
        document.getElementById('vendaEntrega').value = 'nao';
        document.getElementById('vendaObs').value = '';
        document.getElementById('vendaPendente').innerHTML = 'R$ 0,00';
    },

    calcularTotalVenda() {
        const qtd = parseFloat(document.getElementById('vendaQtd').value) || 0;
        const valorUnit = parseFloat(document.getElementById('vendaValorUnit').value) || 0;
        const total = qtd * valorUnit;
        document.getElementById('vendaTotal').value = total.toFixed(2);
        this.calcularPendenteVenda();
    },

    calcularPendenteVenda() {
        const total = parseFloat(document.getElementById('vendaTotal').value) || 0;
        const pago = parseFloat(document.getElementById('vendaValorPago').value) || 0;
        const pendente = total - pago;
        document.getElementById('vendaPendente').innerHTML = `R$ ${pendente.toFixed(2)}`;
    },

    salvarVenda() {
        if (!this.selectedDay) return;

        const cliente = document.getElementById('vendaCliente').value;
        const produto = document.getElementById('vendaProduto').value;
        const quantidade = parseFloat(document.getElementById('vendaQtd').value) || 0;
        const valorUnit = parseFloat(document.getElementById('vendaValorUnit').value) || 0;
        const formaPagamento = document.getElementById('vendaFormaPagamento').value;
        const valorPago = parseFloat(document.getElementById('vendaValorPago').value) || 0;
        const entrega = document.getElementById('vendaEntrega').value;
        const observacoes = document.getElementById('vendaObs').value;

        if (!cliente) {
            alert('Digite o nome do cliente!');
            return;
        }

        if (!produto) {
            alert('Digite o produto!');
            return;
        }

        if (quantidade <= 0 || valorUnit <= 0) {
            alert('Preencha quantidade e valor!');
            return;
        }

        if (!this.events[this.selectedDay].vendas) {
            this.events[this.selectedDay].vendas = [];
        }

        const venda = {
            cliente,
            produto,
            quantidade,
            valorUnit,
            valorPago,
            formaPagamento,
            entrega,
            observacoes
        };

        if (this.vendaEditando !== null) {
            this.events[this.selectedDay].vendas[this.vendaEditando] = venda;
        } else {
            this.events[this.selectedDay].vendas.push(venda);
        }

        this.cancelarFormVenda();
        this.atualizarListaVendas();
        this.atualizarResumoEvento();
        this.salvarDados();
    },

    atualizarListaVendas() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const vendas = this.events[this.selectedDay].vendas || [];
        let html = '';

        vendas.forEach((venda, index) => {
            const valorTotal = venda.quantidade * venda.valorUnit;
            const pendente = valorTotal - (venda.valorPago || 0);
            const statusEntrega = venda.entrega === 'sim' ? '✅' : '⏳';

            html += `
                <div class="venda-card">
                    <div class="venda-header">
                        <span class="cliente-nome">${venda.cliente}</span>
                        <span class="entrega-badge ${venda.entrega}">${venda.entrega === 'sim' ? '✅ Entregue' : '⏳ Pendente'}</span>
                    </div>
                    
                    <div class="venda-produto">
                        ${venda.produto} • ${venda.quantidade}x R$ ${venda.valorUnit.toFixed(2)}
                    </div>
                    
                    <div class="venda-pagamento">
                        <div>Total:<br><strong>R$ ${valorTotal.toFixed(2)}</strong></div>
                        <div>Pago:<br><strong>R$ ${(venda.valorPago || 0).toFixed(2)}</strong></div>
                        <div>Falta:<br><strong class="${pendente > 0 ? 'warning' : 'success'}">R$ ${pendente.toFixed(2)}</strong></div>
                        <div>Forma:<br><strong>${venda.formaPagamento.replace('_', ' ')}</strong></div>
                    </div>
                    
                    <div class="venda-actions">
                        ${pendente > 0 ? 
                            `<button class="btn btn-success btn-sm" style="flex: 1;" onclick="app.abrirPagamento(${index})">💰 Pagar</button>` : ''}
                        <button class="btn btn-outline btn-sm" style="flex: 1;" onclick="app.editarVenda(${index})">✏️</button>
                        <button class="btn btn-danger btn-sm" style="width: 40px;" onclick="app.removerVenda(${index})">🗑️</button>
                    </div>
                </div>
            `;
        });

        document.getElementById('vendasList').innerHTML = html || '<div style="text-align: center; padding: 30px; color: var(--text-light);">Nenhuma venda</div>';
    },

    abrirPagamento(index) {
        this.pagamentoVendaId = index;
        const venda = this.events[this.selectedDay].vendas[index];
        const total = venda.quantidade * venda.valorUnit;
        const pendente = total - (venda.valorPago || 0);
        
        document.getElementById('pagamentoClienteInfo').innerHTML = venda.cliente;
        document.getElementById('pagamentoPendenteAtual').innerHTML = `R$ ${pendente.toFixed(2)}`;
        document.getElementById('pagamentoValor').value = pendente.toFixed(2);
        document.getElementById('formPagamento').classList.remove('hidden');
    },

    cancelarPagamento() {
        document.getElementById('formPagamento').classList.add('hidden');
        this.pagamentoVendaId = null;
    },

    registrarPagamento() {
        if (this.pagamentoVendaId === null || !this.selectedDay) return;

        const valor = parseFloat(document.getElementById('pagamentoValor').value) || 0;
        const forma = document.getElementById('pagamentoForma').value;

        if (valor <= 0) {
            alert('Digite um valor válido!');
            return;
        }

        const venda = this.events[this.selectedDay].vendas[this.pagamentoVendaId];
        const total = venda.quantidade * venda.valorUnit;
        const novoPago = (venda.valorPago || 0) + valor;

        if (novoPago > total) {
            alert('Valor maior que o total!');
            return;
        }

        venda.valorPago = novoPago;
        venda.formaPagamento = forma;

        this.cancelarPagamento();
        this.atualizarListaVendas();
        this.atualizarResumoEvento();
        this.salvarDados();
    },

    editarVenda(index) {
        this.vendaEditando = index;
        const venda = this.events[this.selectedDay].vendas[index];
        
        document.getElementById('vendaCliente').value = venda.cliente;
        document.getElementById('vendaProduto').value = venda.produto;
        document.getElementById('vendaQtd').value = venda.quantidade;
        document.getElementById('vendaValorUnit').value = venda.valorUnit;
        document.getElementById('vendaTotal').value = (venda.quantidade * venda.valorUnit).toFixed(2);
        document.getElementById('vendaFormaPagamento').value = venda.formaPagamento;
        document.getElementById('vendaValorPago').value = venda.valorPago || 0;
        document.getElementById('vendaEntrega').value = venda.entrega || 'nao';
        document.getElementById('vendaObs').value = venda.observacoes || '';
        
        this.calcularPendenteVenda();
        document.getElementById('formVenda').classList.remove('hidden');
    },

    removerVenda(index) {
        if (confirm('Remover esta venda?')) {
            this.events[this.selectedDay].vendas.splice(index, 1);
            this.atualizarListaVendas();
            this.atualizarResumoEvento();
            this.salvarDados();
        }
    },

    // ========== RELATÓRIO DO EVENTO ==========
    atualizarRelatorioEvento() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const evento = this.events[this.selectedDay];
        const ingredientes = evento.ingredientes || [];
        const vendas = evento.vendas || [];
        
        // Custos
        const totalCustos = ingredientes.reduce((acc, item) => acc + (item.doacao ? 0 : item.valorTotal), 0);
        
        // Vendas
        let totalVendas = 0;
        let totalRecebido = 0;
        let totalDinheiro = 0;
        let totalPixVeri = 0;
        let totalPixJheni = 0;
        let totalDebito = 0;
        let totalEntregues = 0;
        let totalItens = 0;

        vendas.forEach(venda => {
            const valorTotal = venda.quantidade * venda.valorUnit;
            totalVendas += valorTotal;
            totalRecebido += venda.valorPago || 0;
            totalItens += venda.quantidade;

            if (venda.entrega === 'sim') totalEntregues++;

            switch(venda.formaPagamento) {
                case 'dinheiro': totalDinheiro += venda.valorPago || 0; break;
                case 'pix_veri': totalPixVeri += venda.valorPago || 0; break;
                case 'pix_jheni': totalPixJheni += venda.valorPago || 0; break;
                case 'debito': totalDebito += venda.valorPago || 0; break;
            }
        });

        const lucro = totalVendas - totalCustos;
        const aReceber = totalVendas - totalRecebido;

        document.getElementById('relCustos').innerHTML = `R$ ${totalCustos.toFixed(2)}`;
        document.getElementById('relVendas').innerHTML = `R$ ${totalVendas.toFixed(2)}`;
        document.getElementById('relLucro').innerHTML = `R$ ${lucro.toFixed(2)}`;
        document.getElementById('relDinheiro').innerHTML = `R$ ${totalDinheiro.toFixed(2)}`;
        document.getElementById('relPixVeri').innerHTML = `R$ ${totalPixVeri.toFixed(2)}`;
        document.getElementById('relPixJheni').innerHTML = `R$ ${totalPixJheni.toFixed(2)}`;
        document.getElementById('relDebito').innerHTML = `R$ ${totalDebito.toFixed(2)}`;
        document.getElementById('relRecebido').innerHTML = `R$ ${totalRecebido.toFixed(2)}`;
        document.getElementById('relAReceber').innerHTML = `R$ ${aReceber.toFixed(2)}`;
        document.getElementById('relEntregues').innerHTML = `${totalEntregues} de ${vendas.length}`;
        document.getElementById('relItens').innerHTML = totalItens;
    },

    // ========== EXCLUIR EVENTO ==========
    excluirEvento() {
        if (!this.selectedDay) return;
        
        if (confirm('🗑️ Excluir este evento permanentemente?')) {
            delete this.events[this.selectedDay];
            this.salvarDados();
            this.voltarCalendario();
        }
    },

    // ========== NAVEGAÇÃO ==========
    voltarCalendario() {
        this.salvarDados();
        document.getElementById('calendarSection').classList.remove('hidden');
        document.getElementById('managementSection').classList.add('hidden');
        this.gerarCalendario();
    },

    mostrarCalendario() {
        document.getElementById('calendarSection').classList.remove('hidden');
        document.getElementById('managementSection').classList.add('hidden');
        this.gerarCalendario();
        
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector('.nav-item:first-child').classList.add('active');
    },

    novaCantinaHoje() {
        const hoje = new Date();
        const dataKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
        this.abrirDia(dataKey);
    },

    mostrarCantinaHoje() {
        this.novaCantinaHoje();
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector('.nav-item:nth-child(2)').classList.add('active');
    },

    // ========== DADOS ==========
    salvarDados() {
        localStorage.setItem('cantinaEvents', JSON.stringify(this.events));
    },

    criarDadosExemplo() {
        const hoje = new Date();
        const dataKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
        
        this.events[dataKey] = {
            eventName: 'Cantina - Jantar',
            responsible: 'Ana Souza',
            notes: 'Preparar com antecedência',
            ingredientes: [
                { nome: 'Pão', quantidade: 30, unidade: 'un', valorTotal: 45.00, doacao: false },
                { nome: 'Salsicha', quantidade: 2, unidade: 'kg', valorTotal: 40.00, doacao: false }
            ],
            vendas: [
                { 
                    cliente: 'João', produto: 'Hot Dog', quantidade: 2, valorUnit: 8.00, 
                    valorPago: 16.00, formaPagamento: 'dinheiro', entrega: 'sim', observacoes: '' 
                },
                { 
                    cliente: 'Maria', produto: 'Hot Dog', quantidade: 3, valorUnit: 8.00, 
                    valorPago: 16.00, formaPagamento: 'pix_veri', entrega: 'nao', observacoes: '' 
                }
            ]
        };
        
        this.salvarDados();
        this.gerarCalendario();
    },

    mostrarRelatorioGeral() {
        const totalEventos = Object.keys(this.events).length;
        let totalVendas = 0;
        let totalRecebido = 0;
        let totalCustos = 0;

        Object.values(this.events).forEach(evento => {
            if (evento.vendas) {
                evento.vendas.forEach(venda => {
                    totalVendas += venda.quantidade * venda.valorUnit;
                    totalRecebido += venda.valorPago || 0;
                });
            }
            if (evento.ingredientes) {
                evento.ingredientes.forEach(ing => {
                    if (!ing.doacao) totalCustos += ing.valorTotal;
                });
            }
        });

        alert(`📊 RELATÓRIO GERAL\n\n` +
              `Eventos: ${totalEventos}\n` +
              `Vendas: R$ ${totalVendas.toFixed(2)}\n` +
              `Recebido: R$ ${totalRecebido.toFixed(2)}\n` +
              `Custos: R$ ${totalCustos.toFixed(2)}\n` +
              `Lucro: R$ ${(totalVendas - totalCustos).toFixed(2)}`);
        
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector('.nav-item:last-child').classList.add('active');
    }
};

// Inicialização
const app = App;
app.init();