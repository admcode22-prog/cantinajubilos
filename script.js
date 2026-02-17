// Configuração do Supabase
const SUPABASE_URL = 'https://uqfznchyfcidyqlqauua.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_covwt0qpmNmdoRy8oGVdng_kgSdCGBT';

const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
};

const App = {
    events: {},
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    selectedDay: null,
    vendaEditando: null,
    pagamentoVendaId: null,
    ingredienteEditando: null,
    producaoEditando: null,
    comprovanteEditando: null,
    carregando: false,
    ingredientesSelecionados: [],

    async init() {
        this.mostrarLoading();
        await this.carregarEventos();
        this.atualizarHeader();
        this.gerarCalendario();
        
        const vendaQtd = document.getElementById('vendaQtd');
        const vendaProdutoId = document.getElementById('vendaProdutoId');
        const vendaValorPago = document.getElementById('vendaValorPago');
        const comprovanteImagem = document.getElementById('comprovanteImagem');
        
        if (vendaQtd) vendaQtd.addEventListener('input', () => this.calcularTotalVenda());
        if (vendaProdutoId) vendaProdutoId.addEventListener('change', () => this.carregarDadosProduto());
        if (vendaValorPago) vendaValorPago.addEventListener('input', () => this.calcularPendenteVenda());
        if (comprovanteImagem) comprovanteImagem.addEventListener('change', (e) => this.previewImagem(e));
        
        this.esconderLoading();
    },

    mostrarLoading() {
        this.carregando = true;
        document.getElementById('loadingOverlay')?.classList.remove('hidden');
    },

    esconderLoading() {
        this.carregando = false;
        document.getElementById('loadingOverlay')?.classList.add('hidden');
    },

    previewImagem(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('previewImage');
                preview.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    },

    async carregarEventos() {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/eventos`, {
                method: 'GET',
                headers: headers
            });
            
            if (!response.ok) throw new Error('Erro ao carregar eventos');
            
            const dados = await response.json();
            
            this.events = {};
            dados.forEach(item => {
                this.events[item.data] = item.evento;
            });
            
            console.log('Eventos carregados:', this.events);
            
        } catch (error) {
            console.error('Erro ao carregar eventos:', error);
            alert('Erro ao carregar dados do servidor. Usando dados locais.');
            
            const localData = localStorage.getItem('cantinaEvents');
            this.events = localData ? JSON.parse(localData) : {};
        }
    },

    async salvarEventoNoSupabase(data, evento) {
        try {
            const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/eventos?data=eq.${data}`, {
                method: 'GET',
                headers: headers
            });
            
            const existente = await checkResponse.json();
            
            if (existente.length > 0) {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/eventos?data=eq.${data}`, {
                    method: 'PATCH',
                    headers: headers,
                    body: JSON.stringify({ 
                        evento: evento,
                        updated_at: new Date().toISOString()
                    })
                });
                
                if (!response.ok) throw new Error('Erro ao atualizar');
            } else {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/eventos`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ 
                        data: data,
                        evento: evento,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                });
                
                if (!response.ok) throw new Error('Erro ao inserir');
            }
            
            console.log('Evento salvo no Supabase:', data);
            
        } catch (error) {
            console.error('Erro ao salvar no Supabase:', error);
            localStorage.setItem('cantinaEvents', JSON.stringify(this.events));
        }
    },

    async removerEventoDoSupabase(data) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/eventos?data=eq.${data}`, {
                method: 'DELETE',
                headers: headers
            });
            
            if (!response.ok) throw new Error('Erro ao remover');
            
            console.log('Evento removido do Supabase:', data);
            
        } catch (error) {
            console.error('Erro ao remover do Supabase:', error);
        }
    },

    async salvarDados() {
        if (!this.selectedDay) return;
        
        const data = this.selectedDay;
        const evento = this.events[data];
        
        await this.salvarEventoNoSupabase(data, evento);
        localStorage.setItem('cantinaEvents', JSON.stringify(this.events));
        
        // Atualizar totais gerais
        this.atualizarTotaisGerais();
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

    async abrirDia(dataKey) {
        this.selectedDay = dataKey;
        
        if (!this.events[dataKey]) {
            this.events[dataKey] = {
                eventName: '',
                responsible: '',
                notes: '',
                producao: [],
                ingredientes: [],
                vendas: [],
                comprovantes: []
            };
            
            await this.salvarEventoNoSupabase(dataKey, this.events[dataKey]);
        }

        const [ano, mes, dia] = dataKey.split('-');
        document.getElementById('selectedDate').innerHTML = `📅 ${dia}/${mes}/${ano}`;
        
        this.carregarDadosEvento();
        
        document.getElementById('calendarSection').classList.add('hidden');
        document.getElementById('managementSection').classList.remove('hidden');
        this.mudarAba('evento');
    },

    carregarDadosEvento() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const evento = this.events[this.selectedDay];
        
        document.getElementById('selectedEventName').innerHTML = evento.eventName || 'Novo Evento';
        document.getElementById('selectedResponsible').innerHTML = `👤 ${evento.responsible || 'Clique para editar'}`;
        
        document.getElementById('eventName').value = evento.eventName || '';
        document.getElementById('responsible').value = evento.responsible || '';
        document.getElementById('notes').value = evento.notes || '';
        
        this.atualizarListaProducao();
        this.atualizarListaIngredientes();
        this.atualizarListaComprovantes();
        this.atualizarListaVendas();
        this.atualizarResumoEvento();
        this.atualizarSelectProdutos();
    },

    atualizarResumoEvento() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const evento = this.events[this.selectedDay];
        const ingredientes = evento.ingredientes || [];
        const vendas = evento.vendas || [];
        
        const totalCustos = ingredientes.reduce((acc, item) => acc + (item.doacao ? 0 : (item.valorTotal || 0)), 0);
        const totalVendas = vendas.reduce((acc, venda) => acc + (venda.quantidade * venda.valorUnit), 0);
        const totalRecebido = vendas.reduce((acc, venda) => acc + (venda.valorPago || 0), 0);
        const aReceber = totalVendas - totalRecebido;
        const lucro = totalVendas - totalCustos;

        document.getElementById('resumoEventoCusto').innerHTML = `R$ ${totalCustos.toFixed(2)}`;
        document.getElementById('resumoEventoVendas').innerHTML = `R$ ${totalVendas.toFixed(2)}`;
        document.getElementById('resumoEventoLucro').innerHTML = `R$ ${lucro.toFixed(2)}`;
        document.getElementById('resumoEventoAReceber').innerHTML = `R$ ${aReceber.toFixed(2)}`;
    },

    mudarAba(aba) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(content => content.classList.remove('active'));
        
        if (aba === 'evento') {
            document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
            document.getElementById('tabEvento').classList.add('active');
            
            if (this.selectedDay && this.events[this.selectedDay]) {
                const evento = this.events[this.selectedDay];
                document.getElementById('eventName').value = evento.eventName || '';
                document.getElementById('responsible').value = evento.responsible || '';
                document.getElementById('notes').value = evento.notes || '';
            }
        } else if (aba === 'custos') {
            document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
            document.getElementById('tabCustos').classList.add('active');
        } else if (aba === 'vendas') {
            document.querySelector('.tab-btn:nth-child(3)').classList.add('active');
            document.getElementById('tabVendas').classList.add('active');
            this.atualizarTotaisGerais();
        } else if (aba === 'relatorio') {
            document.querySelector('.tab-btn:nth-child(4)').classList.add('active');
            document.getElementById('tabRelatorio').classList.add('active');
            this.atualizarRelatorioEvento();
        }
    },

    async salvarEvento() {
        if (!this.selectedDay) return;

        const eventName = document.getElementById('eventName').value;
        const responsible = document.getElementById('responsible').value;
        const notes = document.getElementById('notes').value;

        if (!this.events[this.selectedDay]) {
            this.events[this.selectedDay] = {
                producao: [],
                ingredientes: [],
                vendas: [],
                comprovantes: []
            };
        }

        this.events[this.selectedDay].eventName = eventName;
        this.events[this.selectedDay].responsible = responsible;
        this.events[this.selectedDay].notes = notes;

        document.getElementById('selectedEventName').innerHTML = eventName || 'Novo Evento';
        document.getElementById('selectedResponsible').innerHTML = `👤 ${responsible || 'Clique para editar'}`;

        await this.salvarDados();

        const btn = event.target;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>✅</span> Salvo!';
        btn.style.background = '#10b981';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 1500);
    },

    // ========== PRODUÇÃO ==========
    mostrarFormProducao(producaoId = null) {
        this.producaoEditando = producaoId;
        this.limparFormProducao();
        
        if (producaoId) {
            document.getElementById('producaoEditId').value = producaoId;
            const item = this.events[this.selectedDay].producao.find(p => String(p.id) === String(producaoId));
            if (item) {
                document.getElementById('producaoNome').value = item.nome || '';
                document.getElementById('producaoQuantidade').value = item.quantidade || 0;
                document.getElementById('producaoValor').value = item.valor || 0;
            }
        }
        
        document.getElementById('formProducao').classList.remove('hidden');
    },

    cancelarFormProducao() {
        document.getElementById('formProducao').classList.add('hidden');
        this.producaoEditando = null;
        this.limparFormProducao();
    },

    limparFormProducao() {
        document.getElementById('producaoEditId').value = '';
        document.getElementById('producaoNome').value = '';
        document.getElementById('producaoQuantidade').value = '';
        document.getElementById('producaoValor').value = '';
    },

    async salvarProducao() {
        if (!this.selectedDay) return;

        const id = document.getElementById('producaoEditId').value || Date.now();
        const nome = document.getElementById('producaoNome').value;
        const quantidade = parseInt(document.getElementById('producaoQuantidade').value) || 0;
        const valor = parseFloat(document.getElementById('producaoValor').value) || 0;

        if (!nome) {
            alert('Digite o nome do prato!');
            return;
        }

        if (quantidade <= 0) {
            alert('Digite a quantidade produzida!');
            return;
        }

        if (valor <= 0) {
            alert('Digite o valor de venda!');
            return;
        }

        if (!this.events[this.selectedDay].producao) {
            this.events[this.selectedDay].producao = [];
        }

        const item = {
            id,
            nome,
            quantidade,
            valor,
            vendido: 0
        };

        if (this.producaoEditando) {
            const index = this.events[this.selectedDay].producao.findIndex(p => String(p.id) === String(this.producaoEditando));
            if (index !== -1) {
                this.events[this.selectedDay].producao[index] = item;
            }
        } else {
            this.events[this.selectedDay].producao.push(item);
        }

        this.cancelarFormProducao();
        this.atualizarListaProducao();
        this.atualizarSelectProdutos();
        await this.salvarDados();
    },

    atualizarListaProducao() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const producao = this.events[this.selectedDay].producao || [];
        let html = '';
        let totalItens = 0;

        producao.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

        producao.forEach((item) => {
            const disponivel = item.quantidade - (item.vendido || 0);
            totalItens += disponivel;

            html += `
                <div class="item-card" style="border-left-color: var(--success);">
                    <div class="item-info">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span class="item-name">${item.nome}</span>
                            <span class="item-badge" style="background: var(--primary);">R$ ${item.valor.toFixed(2)}</span>
                        </div>
                        <span class="item-details">Produzido: ${item.quantidade} • Vendido: ${item.vendido || 0} • Disponível: ${disponivel}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button class="btn-icon" style="background: var(--primary);" onclick="app.mostrarFormProducao('${item.id}')" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-icon" style="background: var(--danger);" onclick="app.removerProducao('${item.id}')" title="Remover">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });

        document.getElementById('producaoList').innerHTML = html || '<div style="text-align: center; padding: 20px; color: var(--text-light);">Nenhum prato cadastrado</div>';
        document.getElementById('totalItensProducao').innerHTML = totalItens;
    },

    async removerProducao(id) {
        if (confirm('Remover este prato?')) {
            this.events[this.selectedDay].producao = this.events[this.selectedDay].producao.filter(p => String(p.id) !== String(id));
            this.atualizarListaProducao();
            this.atualizarSelectProdutos();
            await this.salvarDados();
        }
    },

    atualizarSelectProdutos() {
        const select = document.getElementById('vendaProdutoId');
        if (!select) return;

        const producao = this.events[this.selectedDay]?.producao || [];
        
        let options = '<option value="">Selecione um prato</option>';
        
        producao.forEach(item => {
            const disponivel = item.quantidade - (item.vendido || 0);
            if (disponivel > 0) {
                options += `<option value="${item.id}">${item.nome} - R$ ${item.valor.toFixed(2)} (${disponivel} disp)</option>`;
            }
        });

        select.innerHTML = options;
    },

    carregarDadosProduto() {
        const select = document.getElementById('vendaProdutoId');
        const produtoId = select.value;
        
        if (!produtoId) {
            document.getElementById('vendaValorUnit').value = '';
            document.getElementById('vendaDisponivel').value = '';
            return;
        }

        const produto = this.events[this.selectedDay].producao.find(p => String(p.id) === String(produtoId));
        if (produto) {
            const disponivel = produto.quantidade - (produto.vendido || 0);
            document.getElementById('vendaValorUnit').value = produto.valor;
            document.getElementById('vendaDisponivel').value = disponivel;
            document.getElementById('vendaQtd').max = disponivel;
            this.calcularTotalVenda();
        }
    },

    // ========== CUSTOS ==========
    mostrarFormIngrediente(ingredienteId = null) {
        this.ingredienteEditando = ingredienteId;
        const modalTitle = document.getElementById('ingredienteModalTitle');
        
        this.limparFormIngrediente();
        
        if (ingredienteId) {
            modalTitle.innerHTML = '✏️ Editar Ingrediente';
            
            const ingrediente = this.events[this.selectedDay].ingredientes.find(i => String(i.id) === String(ingredienteId));
            
            if (ingrediente) {
                document.getElementById('ingredienteEditId').value = ingrediente.id || '';
                document.getElementById('ingredienteNome').value = ingrediente.nome || '';
                document.getElementById('ingredienteQtd').value = ingrediente.quantidade || '';
                document.getElementById('ingredienteUnidade').value = ingrediente.unidade || 'un';
                document.getElementById('ingredienteValor').value = ingrediente.valorTotal || '';
                document.getElementById('ingredienteComprado').checked = ingrediente.comprado || false;
                document.getElementById('ingredienteDoacao').checked = ingrediente.doacao || false;
                
                if (ingrediente.comprovanteId) {
                    document.getElementById('ingredienteComprovanteId').value = ingrediente.comprovanteId;
                }
            }
        } else {
            modalTitle.innerHTML = '➕ Ingrediente';
        }
        
        this.atualizarSelectComprovantes();
        document.getElementById('formIngrediente').classList.remove('hidden');
    },

    atualizarSelectComprovantes() {
        const select = document.getElementById('ingredienteComprovanteId');
        if (!select) return;
        
        select.innerHTML = '<option value="">Nenhum</option>';
        
        const comprovantes = this.events[this.selectedDay]?.comprovantes || [];
        comprovantes.forEach(comp => {
            const option = document.createElement('option');
            option.value = comp.id;
            option.textContent = `${comp.nome} (R$ ${(comp.valorTotal || 0).toFixed(2)})`;
            select.appendChild(option);
        });
        
        const container = document.getElementById('comprovanteSelectContainer');
        if (container) {
            container.style.display = comprovantes.length > 0 ? 'block' : 'none';
        }
    },

    cancelarFormIngrediente() {
        document.getElementById('formIngrediente').classList.add('hidden');
        this.ingredienteEditando = null;
        this.limparFormIngrediente();
    },

    limparFormIngrediente() {
        document.getElementById('ingredienteEditId').value = '';
        document.getElementById('ingredienteNome').value = '';
        document.getElementById('ingredienteQtd').value = '';
        document.getElementById('ingredienteUnidade').value = 'un';
        document.getElementById('ingredienteValor').value = '';
        document.getElementById('ingredienteComprado').checked = false;
        document.getElementById('ingredienteDoacao').checked = false;
        document.getElementById('ingredienteComprovanteId').value = '';
        
        const preview = document.getElementById('previewImage');
        if (preview) {
            preview.src = '#';
            preview.style.display = 'none';
        }
    },

    async salvarIngrediente() {
        if (!this.selectedDay) return;

        const id = document.getElementById('ingredienteEditId').value || Date.now();
        const nome = document.getElementById('ingredienteNome').value;
        const quantidade = parseFloat(document.getElementById('ingredienteQtd').value) || 0;
        const unidade = document.getElementById('ingredienteUnidade').value;
        const valorTotal = parseFloat(document.getElementById('ingredienteValor').value) || 0;
        const comprado = document.getElementById('ingredienteComprado').checked;
        const doacao = document.getElementById('ingredienteDoacao').checked;
        const comprovanteId = document.getElementById('ingredienteComprovanteId').value || null;

        if (!nome) {
            alert('Digite o nome do ingrediente!');
            return;
        }

        if (quantidade <= 0) {
            alert('Digite a quantidade!');
            return;
        }

        if (!this.events[this.selectedDay].ingredientes) {
            this.events[this.selectedDay].ingredientes = [];
        }

        const ingrediente = {
            id: id,
            nome: nome,
            quantidade: quantidade,
            unidade: unidade,
            valorTotal: valorTotal,
            comprado: comprado,
            doacao: doacao,
            comprovanteId: comprovanteId
        };

        if (this.ingredienteEditando) {
            const index = this.events[this.selectedDay].ingredientes.findIndex(i => String(i.id) === String(this.ingredienteEditando));
            if (index !== -1) {
                this.events[this.selectedDay].ingredientes[index] = ingrediente;
            } else {
                this.events[this.selectedDay].ingredientes.push(ingrediente);
            }
        } else {
            this.events[this.selectedDay].ingredientes.push(ingrediente);
        }

        this.cancelarFormIngrediente();
        this.atualizarListaIngredientes();
        this.atualizarListaComprovantes();
        this.atualizarResumoEvento();
        await this.salvarDados();
    },

    atualizarListaIngredientes() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const ingredientes = this.events[this.selectedDay].ingredientes || [];
        const comprovantes = this.events[this.selectedDay].comprovantes || [];
        let html = '';

        ingredientes.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

        ingredientes.forEach((item) => {
            const itemId = item.id || Date.now() + Math.random();
            const compradoClass = item.comprado ? 'comprado' : '';
            const compradoText = item.comprado ? '✅' : '⏳';
            
            const valorDisplay = item.valorTotal > 0 ? `R$ ${item.valorTotal.toFixed(2)}` : '💰 A definir';
            
            const temComprovante = item.comprovanteId ? true : false;
            const comprovante = temComprovante ? comprovantes.find(c => String(c.id) === String(item.comprovanteId)) : null;
            
            html += `
                <div class="item-card ${compradoClass}" data-id="${itemId}" style="${item.comprado ? 'opacity: 0.8;' : ''}">
                    <div class="item-info">
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span class="item-name">${item.nome || 'Sem nome'}</span>
                            ${item.doacao ? '<span class="item-badge">🎁 Doação</span>' : ''}
                            ${item.comprado ? '<span class="item-badge" style="background: var(--success);">✓ Comprado</span>' : ''}
                            ${item.valorTotal === 0 && !item.doacao ? '<span class="item-badge" style="background: var(--warning);">⏳ Pendente</span>' : ''}
                            ${temComprovante ? '<span class="item-badge" style="background: var(--primary);">📎 Comprovante</span>' : ''}
                        </div>
                        <span class="item-details">${item.quantidade || 0} ${item.unidade || 'un'} • ${valorDisplay}</span>
                        ${temComprovante ? `
                            <div style="display: flex; align-items: center; gap: 4px; margin-top: 4px;">
                                <span class="item-details" style="color: var(--primary);">📎 ${comprovante?.nome || 'Comprovante'}</span>
                                <button class="btn-icon" style="background: var(--primary); width: 24px; height: 24px; font-size: 0.8rem;" onclick="app.verComprovanteDoIngrediente('${item.comprovanteId}')" title="Ver comprovante">
                                    👁️
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button class="btn-icon" style="background: var(--success);" onclick="app.toggleCompradoIngrediente('${itemId}')" title="Marcar como comprado">
                            ${compradoText}
                        </button>
                        <button class="btn-icon" style="background: var(--primary);" onclick="app.mostrarFormIngrediente('${itemId}')" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-icon" style="background: var(--danger);" onclick="app.removerIngrediente('${itemId}')" title="Remover">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });

        document.getElementById('ingredientesList').innerHTML = html || '<div style="text-align: center; padding: 20px; color: var(--text-light);">Nenhum ingrediente</div>';
    },

    verComprovanteDoIngrediente(comprovanteId) {
        if (!comprovanteId) return;
        
        const comprovante = this.events[this.selectedDay].comprovantes.find(c => String(c.id) === String(comprovanteId));
        this.mostrarComprovanteEmJanela(comprovante);
    },

    async toggleCompradoIngrediente(id) {
        const ingrediente = this.events[this.selectedDay].ingredientes.find(i => String(i.id) === String(id));
        if (ingrediente) {
            ingrediente.comprado = !ingrediente.comprado;
            this.atualizarListaIngredientes();
            await this.salvarDados();
        }
    },

    async removerIngrediente(id) {
        if (confirm('Remover este ingrediente?')) {
            this.events[this.selectedDay].ingredientes = this.events[this.selectedDay].ingredientes.filter(i => String(i.id) !== String(id));
            this.atualizarListaIngredientes();
            this.atualizarListaComprovantes();
            this.atualizarResumoEvento();
            await this.salvarDados();
        }
    },

    // ========== COMPROVANTES ==========
    mostrarFormComprovante(comprovanteId = null) {
        this.comprovanteEditando = comprovanteId;
        this.ingredientesSelecionados = [];
        
        this.limparFormComprovante();
        
        if (comprovanteId) {
            const comprovante = this.events[this.selectedDay].comprovantes.find(c => String(c.id) === String(comprovanteId));
            if (comprovante) {
                document.getElementById('comprovanteEditId').value = comprovante.id;
                document.getElementById('comprovanteNome').value = comprovante.nome || '';
                document.getElementById('comprovanteData').value = comprovante.data || '';
                document.getElementById('comprovanteValor').value = comprovante.valorTotal || 0;
                
                if (comprovante.imagem) {
                    const preview = document.getElementById('previewImage');
                    preview.src = comprovante.imagem;
                    preview.style.display = 'block';
                }
                
                const ingredientes = this.events[this.selectedDay].ingredientes || [];
                this.ingredientesSelecionados = ingredientes
                    .filter(i => String(i.comprovanteId) === String(comprovante.id))
                    .map(i => String(i.id));
            }
        }
        
        this.atualizarListaIngredientesParaComprovante();
        document.getElementById('formComprovante').classList.remove('hidden');
    },

    atualizarListaIngredientesParaComprovante() {
        const container = document.getElementById('comprovanteItensList');
        if (!container) return;
        
        const ingredientes = this.events[this.selectedDay]?.ingredientes || [];
        
        if (ingredientes.length === 0) {
            container.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 10px;">Nenhum ingrediente cadastrado</p>';
            return;
        }
        
        let html = '';
        
        ingredientes.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        
        ingredientes.forEach(item => {
            const itemId = String(item.id);
            const estaSelecionado = this.ingredientesSelecionados.includes(itemId);
            const valorDisplay = item.valorTotal > 0 ? `R$ ${item.valorTotal.toFixed(2)}` : '💰 A definir';
            
            html += `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px; border-bottom: 1px solid var(--border); background: ${estaSelecionado ? 'rgba(249, 115, 22, 0.1)' : 'transparent'};">
                    <input type="checkbox" 
                           id="ingrediente_${itemId}" 
                           value="${itemId}"
                           ${estaSelecionado ? 'checked' : ''}
                           onchange="app.toggleIngredienteComprovante('${itemId}')"
                           style="width: 20px; height: 20px; cursor: pointer;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600;">${item.nome}</div>
                        <div style="font-size: 0.8rem; color: var(--text-light);">${item.quantidade} ${item.unidade} • ${valorDisplay}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    },

    toggleIngredienteComprovante(ingredienteId) {
        const index = this.ingredientesSelecionados.indexOf(String(ingredienteId));
        if (index === -1) {
            this.ingredientesSelecionados.push(String(ingredienteId));
        } else {
            this.ingredientesSelecionados.splice(index, 1);
        }
        
        const checkbox = document.getElementById(`ingrediente_${ingredienteId}`);
        if (checkbox) {
            checkbox.checked = (index === -1);
            const itemDiv = checkbox.closest('div[style*="display: flex"]');
            if (itemDiv) {
                itemDiv.style.background = (index === -1) ? 'rgba(249, 115, 22, 0.1)' : 'transparent';
            }
        }
    },

    cancelarFormComprovante() {
        document.getElementById('formComprovante').classList.add('hidden');
        this.comprovanteEditando = null;
        this.ingredientesSelecionados = [];
        this.limparFormComprovante();
    },

    limparFormComprovante() {
        document.getElementById('comprovanteEditId').value = '';
        document.getElementById('comprovanteNome').value = '';
        document.getElementById('comprovanteData').value = '';
        document.getElementById('comprovanteValor').value = '';
        document.getElementById('comprovanteImagem').value = '';
        
        const preview = document.getElementById('previewImage');
        preview.src = '#';
        preview.style.display = 'none';
    },

    async salvarComprovante() {
        if (!this.selectedDay) return;

        const id = document.getElementById('comprovanteEditId').value || Date.now();
        const nome = document.getElementById('comprovanteNome').value;
        const data = document.getElementById('comprovanteData').value;
        const valorTotal = parseFloat(document.getElementById('comprovanteValor').value) || 0;
        const imagemInput = document.getElementById('comprovanteImagem');
        
        let imagem = null;
        if (imagemInput.files && imagemInput.files[0]) {
            const reader = new FileReader();
            imagem = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(imagemInput.files[0]);
            });
        }

        if (!nome) {
            alert('Digite o nome do comprovante!');
            return;
        }

        if (!this.events[this.selectedDay].comprovantes) {
            this.events[this.selectedDay].comprovantes = [];
        }

        const comprovante = {
            id,
            nome,
            data,
            valorTotal,
            imagem: imagem || (this.comprovanteEditando ? 
                this.events[this.selectedDay].comprovantes.find(c => String(c.id) === String(this.comprovanteEditando))?.imagem : null)
        };

        if (this.comprovanteEditando) {
            const index = this.events[this.selectedDay].comprovantes.findIndex(c => String(c.id) === String(this.comprovanteEditando));
            if (index !== -1) {
                this.events[this.selectedDay].comprovantes[index] = comprovante;
            }
        } else {
            this.events[this.selectedDay].comprovantes.push(comprovante);
        }

        if (this.events[this.selectedDay].ingredientes) {
            if (this.comprovanteEditando) {
                this.events[this.selectedDay].ingredientes.forEach(item => {
                    if (String(item.comprovanteId) === String(this.comprovanteEditando)) {
                        item.comprovanteId = null;
                    }
                });
            }
            
            this.events[this.selectedDay].ingredientes.forEach(item => {
                if (this.ingredientesSelecionados.includes(String(item.id))) {
                    item.comprovanteId = id;
                }
            });
        }

        this.cancelarFormComprovante();
        this.atualizarListaIngredientes();
        this.atualizarListaComprovantes();
        this.atualizarSelectComprovantes();
        this.atualizarResumoEvento();
        await this.salvarDados();
    },

    atualizarListaComprovantes() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const comprovantes = this.events[this.selectedDay].comprovantes || [];
        const ingredientes = this.events[this.selectedDay].ingredientes || [];
        let html = '';

        comprovantes.forEach((comp) => {
            const itensVinculados = ingredientes
                .filter(i => String(i.comprovanteId) === String(comp.id));
            
            const totalItens = itensVinculados.length;
            const totalValorItens = itensVinculados.reduce((acc, item) => acc + (item.valorTotal || 0), 0);
            
            const itensList = itensVinculados.map(item => 
                `<div style="font-size: 0.7rem; color: var(--text-light); margin-left: 10px;">• ${item.nome} - R$ ${(item.valorTotal || 0).toFixed(2)}</div>`
            ).join('');
            
            html += `
                <div class="item-card" style="border-left-color: var(--success);">
                    <div class="item-info">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span class="item-name">📎 ${comp.nome}</span>
                            <span class="item-badge" style="background: var(--primary);">${totalItens} itens</span>
                        </div>
                        <span class="item-details">${comp.data || 'Sem data'} • R$ ${(comp.valorTotal || 0).toFixed(2)}</span>
                        <span class="item-details">Valor nos itens: R$ ${totalValorItens.toFixed(2)}</span>
                        
                        ${totalItens > 0 ? `
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border);">
                                <div style="font-weight: 600; font-size: 0.8rem; margin-bottom: 4px;">Itens neste comprovante:</div>
                                ${itensList}
                            </div>
                        ` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button class="btn-icon" style="background: var(--primary);" onclick="app.verComprovante('${comp.id}')" title="Ver">
                            👁️
                        </button>
                        <button class="btn-icon" style="background: var(--warning);" onclick="app.mostrarFormComprovante('${comp.id}')" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-icon" style="background: var(--danger);" onclick="app.removerComprovante('${comp.id}')" title="Remover">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });

        document.getElementById('comprovantesList').innerHTML = html || '<div style="text-align: center; padding: 20px; color: var(--text-light);">Nenhum comprovante</div>';
    },

    verComprovante(id) {
        const comprovante = this.events[this.selectedDay].comprovantes.find(c => String(c.id) === String(id));
        this.mostrarComprovanteEmJanela(comprovante);
    },

    mostrarComprovanteEmJanela(comprovante) {
        if (!comprovante?.imagem) {
            alert('Este comprovante não possui imagem!');
            return;
        }
        
        const ingredientes = this.events[this.selectedDay].ingredientes || [];
        const itensVinculados = ingredientes.filter(i => String(i.comprovanteId) === String(comprovante.id));
        
        const win = window.open();
        win.document.write(`
            <html>
                <head>
                    <title>${comprovante.nome}</title>
                    <style>
                        body {
                            margin: 0;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            background: #f0f0f0;
                            font-family: Arial, sans-serif;
                            padding: 20px;
                        }
                        .container {
                            max-width: 90%;
                            background: white;
                            padding: 20px;
                            border-radius: 10px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        }
                        .header {
                            margin-bottom: 20px;
                            padding-bottom: 10px;
                            border-bottom: 1px solid #eee;
                        }
                        .header h2 {
                            margin: 0;
                            color: #f97316;
                        }
                        .header p {
                            margin: 5px 0 0;
                            color: #666;
                        }
                        .itens-list {
                            margin: 20px 0;
                            padding: 15px;
                            background: #f9f9f9;
                            border-radius: 8px;
                        }
                        .itens-list h3 {
                            margin: 0 0 10px 0;
                            font-size: 1rem;
                            color: #333;
                        }
                        .itens-list ul {
                            margin: 0;
                            padding-left: 20px;
                        }
                        .itens-list li {
                            margin-bottom: 5px;
                        }
                        img {
                            max-width: 100%;
                            max-height: 60vh;
                            object-fit: contain;
                            border-radius: 8px;
                            margin-top: 15px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>📎 ${comprovante.nome}</h2>
                            <p>Data: ${comprovante.data || 'Não informada'} • Valor Total: R$ ${(comprovante.valorTotal || 0).toFixed(2)}</p>
                        </div>
                        
                        ${itensVinculados.length > 0 ? `
                            <div class="itens-list">
                                <h3>🛒 Itens neste comprovante:</h3>
                                <ul>
                                    ${itensVinculados.map(item => 
                                        `<li>${item.nome} - ${item.quantidade} ${item.unidade} - R$ ${(item.valorTotal || 0).toFixed(2)}</li>`
                                    ).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        
                        <img src="${comprovante.imagem}" alt="Comprovante">
                    </div>
                </body>
            </html>
        `);
    },

    async removerComprovante(id) {
        if (confirm('Remover este comprovante? Os itens vinculados serão desvinculados.')) {
            if (this.events[this.selectedDay].ingredientes) {
                this.events[this.selectedDay].ingredientes.forEach(item => {
                    if (String(item.comprovanteId) === String(id)) {
                        item.comprovanteId = null;
                    }
                });
            }
            
            this.events[this.selectedDay].comprovantes = this.events[this.selectedDay].comprovantes.filter(c => String(c.id) !== String(id));
            
            this.atualizarListaIngredientes();
            this.atualizarListaComprovantes();
            this.atualizarSelectComprovantes();
            await this.salvarDados();
        }
    },

    // ========== VENDAS ==========
    mostrarFormVenda() {
        this.atualizarSelectProdutos();
        document.getElementById('formVenda').classList.remove('hidden');
        this.limparFormVenda();
    },

    cancelarFormVenda() {
        document.getElementById('formVenda').classList.add('hidden');
        this.vendaEditando = null;
    },

    limparFormVenda() {
        document.getElementById('vendaCliente').value = '';
        document.getElementById('vendaProdutoId').value = '';
        document.getElementById('vendaQtd').value = '1';
        document.getElementById('vendaValorUnit').value = '';
        document.getElementById('vendaTotal').value = '';
        document.getElementById('vendaFormaPagamento').value = 'dinheiro';
        document.getElementById('vendaValorPago').value = '';
        document.getElementById('vendaEntrega').value = 'nao';
        document.getElementById('vendaObs').value = '';
        document.getElementById('vendaDisponivel').value = '';
        document.getElementById('vendaPendente').value = 'R$ 0,00';
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
        document.getElementById('vendaPendente').value = `R$ ${pendente.toFixed(2)}`;
    },

    async salvarVenda() {
        if (!this.selectedDay) return;

        const cliente = document.getElementById('vendaCliente').value;
        const produtoId = document.getElementById('vendaProdutoId').value;
        const quantidade = parseInt(document.getElementById('vendaQtd').value) || 0;
        const valorUnit = parseFloat(document.getElementById('vendaValorUnit').value) || 0;
        const formaPagamento = document.getElementById('vendaFormaPagamento').value;
        const valorPago = parseFloat(document.getElementById('vendaValorPago').value) || 0;
        const entrega = document.getElementById('vendaEntrega').value;
        const observacoes = document.getElementById('vendaObs').value;

        if (!cliente) {
            alert('Digite o nome do cliente!');
            return;
        }

        if (!produtoId) {
            alert('Selecione um produto!');
            return;
        }

        const produto = this.events[this.selectedDay].producao.find(p => String(p.id) === String(produtoId));
        if (!produto) {
            alert('Produto não encontrado!');
            return;
        }

        const disponivel = produto.quantidade - (produto.vendido || 0);
        if (quantidade > disponivel) {
            alert(`Quantidade indisponível! Disponível: ${disponivel}`);
            return;
        }

        if (quantidade <= 0) {
            alert('Digite a quantidade!');
            return;
        }

        if (!this.events[this.selectedDay].vendas) {
            this.events[this.selectedDay].vendas = [];
        }

        const venda = {
            id: this.vendaEditando || Date.now(),
            cliente,
            produtoId,
            produtoNome: produto.nome,
            quantidade,
            valorUnit,
            valorPago,
            formaPagamento,
            entrega,
            observacoes,
            data: new Date().toISOString()
        };

        if (this.vendaEditando) {
            const index = this.events[this.selectedDay].vendas.findIndex(v => String(v.id) === String(this.vendaEditando));
            if (index !== -1) {
                this.events[this.selectedDay].vendas[index] = venda;
            }
        } else {
            this.events[this.selectedDay].vendas.push(venda);
            produto.vendido = (produto.vendido || 0) + quantidade;
        }

        this.cancelarFormVenda();
        this.atualizarListaProducao();
        this.atualizarListaVendas();
        this.atualizarResumoEvento();
        this.atualizarSelectProdutos();
        this.atualizarTotaisGerais();
        await this.salvarDados();
    },

    atualizarListaVendas() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const vendas = this.events[this.selectedDay].vendas || [];
        let html = '';

        vendas.sort((a, b) => new Date(b.data) - new Date(a.data));

        vendas.forEach((venda) => {
            const valorTotal = venda.quantidade * venda.valorUnit;
            const pendente = valorTotal - (venda.valorPago || 0);

            html += `
                <div class="venda-card" data-id="${venda.id}">
                    <div class="venda-header">
                        <span class="cliente-nome">${venda.cliente}</span>
                        <span class="entrega-badge ${venda.entrega}">${venda.entrega === 'sim' ? '✅ Entregue' : '⏳ Pendente'}</span>
                    </div>
                    
                    <div class="venda-produto">
                        ${venda.produtoNome} • ${venda.quantidade}x R$ ${venda.valorUnit.toFixed(2)}
                    </div>
                    
                    <div class="venda-pagamento">
                        <div>Total:<br><strong>R$ ${valorTotal.toFixed(2)}</strong></div>
                        <div>Pago:<br><strong>R$ ${(venda.valorPago || 0).toFixed(2)}</strong></div>
                        <div>Falta:<br><strong class="${pendente > 0 ? 'warning' : 'success'}">R$ ${pendente.toFixed(2)}</strong></div>
                        <div>Forma:<br><strong>${venda.formaPagamento?.replace('_', ' ') || ''}</strong></div>
                    </div>
                    
                    <div class="venda-actions">
                        ${pendente > 0 ? 
                            `<button class="btn btn-success btn-sm" style="flex: 1;" onclick="app.abrirPagamento('${venda.id}')">💰 Pagar</button>` : ''}
                        <button class="btn btn-outline btn-sm" style="flex: 1;" onclick="app.editarVenda('${venda.id}')">✏️</button>
                        <button class="btn btn-danger btn-sm" style="width: 40px;" onclick="app.removerVenda('${venda.id}')">🗑️</button>
                    </div>
                </div>
            `;
        });

        document.getElementById('vendasList').innerHTML = html || '<div style="text-align: center; padding: 30px; color: var(--text-light);">Nenhuma venda</div>';
    },

    abrirPagamento(id) {
        this.pagamentoVendaId = id;
        const venda = this.events[this.selectedDay].vendas.find(v => String(v.id) === String(id));
        if (!venda) return;
        
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

    async registrarPagamento() {
        if (this.pagamentoVendaId === null || !this.selectedDay) return;

        const valor = parseFloat(document.getElementById('pagamentoValor').value) || 0;
        const forma = document.getElementById('pagamentoForma').value;

        if (valor <= 0) {
            alert('Digite um valor válido!');
            return;
        }

        const venda = this.events[this.selectedDay].vendas.find(v => String(v.id) === String(this.pagamentoVendaId));
        if (!venda) return;
        
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
        this.atualizarTotaisGerais();
        await this.salvarDados();
    },

    editarVenda(id) {
        this.vendaEditando = id;
        const venda = this.events[this.selectedDay].vendas.find(v => String(v.id) === String(id));
        if (!venda) return;
        
        document.getElementById('vendaCliente').value = venda.cliente || '';
        document.getElementById('vendaProdutoId').value = venda.produtoId || '';
        document.getElementById('vendaQtd').value = venda.quantidade || 1;
        document.getElementById('vendaValorUnit').value = venda.valorUnit || 0;
        document.getElementById('vendaTotal').value = (venda.quantidade * venda.valorUnit).toFixed(2);
        document.getElementById('vendaFormaPagamento').value = venda.formaPagamento || 'dinheiro';
        document.getElementById('vendaValorPago').value = venda.valorPago || 0;
        document.getElementById('vendaEntrega').value = venda.entrega || 'nao';
        document.getElementById('vendaObs').value = venda.observacoes || '';
        
        this.calcularPendenteVenda();
        document.getElementById('formVenda').classList.remove('hidden');
    },

    async removerVenda(id) {
        if (confirm('Remover esta venda?')) {
            const venda = this.events[this.selectedDay].vendas.find(v => String(v.id) === String(id));
            if (venda) {
                const produto = this.events[this.selectedDay].producao.find(p => String(p.id) === String(venda.produtoId));
                if (produto) {
                    produto.vendido = (produto.vendido || 0) - venda.quantidade;
                }
            }
            
            this.events[this.selectedDay].vendas = this.events[this.selectedDay].vendas.filter(v => String(v.id) !== String(id));
            this.atualizarListaProducao();
            this.atualizarListaVendas();
            this.atualizarResumoEvento();
            this.atualizarSelectProdutos();
            this.atualizarTotaisGerais();
            await this.salvarDados();
        }
    },

    // ========== TOTAIS GERAIS ==========
    atualizarTotaisGerais() {
        const hoje = new Date().toISOString().split('T')[0];
        const hojeKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
        
        let totalVendasHoje = 0;
        let totalVendasGeral = 0;
        let totalRecebidoGeral = 0;
        let totalCustosGeral = 0;

        Object.values(this.events).forEach(evento => {
            if (evento.vendas) {
                evento.vendas.forEach(venda => {
                    const valorTotal = venda.quantidade * venda.valorUnit;
                    totalVendasGeral += valorTotal;
                    totalRecebidoGeral += venda.valorPago || 0;
                    
                    // Verificar se é venda de hoje
                    if (evento.data === hojeKey) {
                        totalVendasHoje += valorTotal;
                    }
                });
            }
            
            if (evento.ingredientes) {
                evento.ingredientes.forEach(ing => {
                    if (!ing.doacao) totalCustosGeral += ing.valorTotal || 0;
                });
            }
        });

        const liquidoGeral = totalRecebidoGeral - totalCustosGeral;

        document.getElementById('resumoVendasHoje').innerHTML = `R$ ${totalVendasHoje.toFixed(2)}`;
        document.getElementById('resumoVendasGeral').innerHTML = `R$ ${totalVendasGeral.toFixed(2)}`;
        document.getElementById('resumoRecebidoGeral').innerHTML = `R$ ${totalRecebidoGeral.toFixed(2)}`;
        document.getElementById('resumoLiquido').innerHTML = `R$ ${liquidoGeral.toFixed(2)}`;
    },

    // ========== RELATÓRIOS ==========
    atualizarRelatorioEvento() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const evento = this.events[this.selectedDay];
        const producao = evento.producao || [];
        const ingredientes = evento.ingredientes || [];
        const vendas = evento.vendas || [];
        const comprovantes = evento.comprovantes || [];
        
        const totalCustos = ingredientes.reduce((acc, item) => acc + (item.doacao ? 0 : (item.valorTotal || 0)), 0);
        const totalComprado = ingredientes
            .filter(item => item.comprado && !item.doacao && item.valorTotal > 0)
            .reduce((acc, item) => acc + (item.valorTotal || 0), 0);
        const itensComprados = ingredientes.filter(item => item.comprado).length;
        const itensSemValor = ingredientes.filter(item => (item.valorTotal === 0 || !item.valorTotal) && !item.doacao).length;
        
        // Estatísticas de produção
        const totalProduzido = producao.reduce((acc, item) => acc + item.quantidade, 0);
        const totalVendidos = producao.reduce((acc, item) => acc + (item.vendido || 0), 0);
        const totalRestantes = totalProduzido - totalVendidos;
        
        let totalVendas = 0;
        let totalRecebido = 0;
        let totalDinheiro = 0;
        let totalPixVeri = 0;
        let totalPixJheni = 0;
        let totalDebito = 0;
        let totalEntregues = 0;

        vendas.forEach(venda => {
            const valorTotal = venda.quantidade * venda.valorUnit;
            totalVendas += valorTotal;
            totalRecebido += venda.valorPago || 0;

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
        
        // Novos campos de produção
        document.getElementById('relItensProduzidos').innerHTML = totalProduzido;
        document.getElementById('relItensVendidos').innerHTML = totalVendidos;
        document.getElementById('relItensRestantes').innerHTML = totalRestantes;
        
        document.getElementById('relItensComprados').innerHTML = itensComprados;
        document.getElementById('relTotalComprovantes').innerHTML = comprovantes.length;
        document.getElementById('relTotalComprado').innerHTML = `R$ ${totalComprado.toFixed(2)}`;
        
        let semValorRow = document.getElementById('relItensSemValor');
        if (semValorRow) {
            semValorRow.querySelector('.report-value').innerHTML = itensSemValor;
        }
    },

    // ========== NAVEGAÇÃO ==========
    async excluirEvento() {
        if (!this.selectedDay) return;
        
        if (confirm('🗑️ Excluir este evento permanentemente?')) {
            const data = this.selectedDay;
            delete this.events[data];
            
            try {
                await fetch(`${SUPABASE_URL}/rest/v1/eventos?data=eq.${data}`, {
                    method: 'DELETE',
                    headers: headers
                });
            } catch (error) {
                console.error('Erro ao remover do Supabase:', error);
            }
            
            localStorage.setItem('cantinaEvents', JSON.stringify(this.events));
            this.voltarCalendario();
            this.atualizarTotaisGerais();
        }
    },

    voltarCalendario() {
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
                    if (!ing.doacao) totalCustos += ing.valorTotal || 0;
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