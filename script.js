// Configuração do Supabase
const SUPABASE_URL = 'https://uqfznchyfcidyqlqauua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxZnpuY2h5ZmNpZHlxbHFhdXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5OTI4NzUsImV4cCI6MjA4NjU2ODg3NX0.eGvAs-vgw96PYp0xqtrt4NieEcUE36WdfP9r8h22Jd0';

const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Prefer': 'return=representation'
};

const TABLES = {
    EVENTOS: 'eventos',
    PRODUCAO: 'producao',
    INGREDIENTES: 'ingredientes',
    VENDAS: 'vendas',
    COMPROVANTES: 'comprovantes'
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
    filtroTipo: 'todos',   // 'todos', 'entrega', 'retirada'
    buscaCliente: '',

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

    mostrarLoading() { this.carregando = true; document.getElementById('loadingOverlay')?.classList.remove('hidden'); },
    esconderLoading() { this.carregando = false; document.getElementById('loadingOverlay')?.classList.add('hidden'); },

    previewImagem(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => { const preview = document.getElementById('previewImage'); preview.src = e.target.result; preview.style.display = 'block'; };
            reader.readAsDataURL(file);
        }
    },

    async carregarEventos() {
        try {
            console.log('Carregando eventos do Supabase...');
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.EVENTOS}?order=created_at.desc`, {
                method: 'GET', headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
            });
            if (!response.ok) throw new Error(`Erro ao carregar eventos: ${response.status}`);
            const eventos = await response.json();
            this.events = {};
            for (const evento of eventos) {
                const data = evento.data;
                try {
                    const [producao, comprovantes, ingredientes, vendas] = await Promise.all([
                        fetch(`${SUPABASE_URL}/rest/v1/${TABLES.PRODUCAO}?evento_id=eq.${evento.id}&select=*`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }).then(r => r.ok ? r.json() : []),
                        fetch(`${SUPABASE_URL}/rest/v1/${TABLES.COMPROVANTES}?evento_id=eq.${evento.id}&select=*`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }).then(r => r.ok ? r.json() : []),
                        fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}?evento_id=eq.${evento.id}&select=*`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }).then(r => r.ok ? r.json() : []),
                        fetch(`${SUPABASE_URL}/rest/v1/${TABLES.VENDAS}?evento_id=eq.${evento.id}&select=*`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }).then(r => r.ok ? r.json() : [])
                    ]);
                    this.events[data] = { id: evento.id, eventName: evento.eventName || '', responsible: evento.responsible || '', notes: evento.notes || '', producao, comprovantes, ingredientes, vendas };
                } catch (error) { console.error(`Erro ao carregar dados do evento ${data}:`, error); this.events[data] = { id: evento.id, eventName: evento.eventName || '', responsible: evento.responsible || '', notes: evento.notes || '', producao: [], comprovantes: [], ingredientes: [], vendas: [] }; }
            }
            const eventsBackup = {};
            for (const [data, event] of Object.entries(this.events)) eventsBackup[data] = { ...event, comprovantes: event.comprovantes.map(c => ({ ...c, imagem: null })) };
            try { localStorage.setItem('cantinaEvents', JSON.stringify(eventsBackup)); } catch (e) { console.warn('Não foi possível fazer backup no localStorage'); }
        } catch (error) { console.error('Erro ao carregar eventos:', error); try { const localData = localStorage.getItem('cantinaEvents'); if (localData) this.events = JSON.parse(localData); else this.events = {}; } catch (e) { this.events = {}; } }
    },

    async sincronizarVendasComProducao() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;
        try {
            this.mostrarLoading();
            const evento = this.events[this.selectedDay];
            const vendas = evento.vendas || [];
            const producao = evento.producao || [];
            for (const produto of producao) {
                const totalVendido = vendas.filter(v => String(v.produtoId) === String(produto.id)).reduce((acc, venda) => acc + venda.quantidade, 0);
                if ((produto.vendido || 0) !== totalVendido) {
                    await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.PRODUCAO}?id=eq.${produto.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ vendido: totalVendido }) });
                }
            }
            await this.carregarEventos();
            this.carregarDadosEvento();
            alert('✅ Vendas sincronizadas com produção!');
        } catch (error) { console.error('Erro ao sincronizar:', error); alert('Erro ao sincronizar dados'); }
        finally { this.esconderLoading(); }
    },

    async getOrCreateEventoId(data) {
        try {
            const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/eventos?data=eq.${data}&select=id`, { method: 'GET', headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
            if (!checkResponse.ok) return null;
            const existente = await checkResponse.json();
            if (existente && existente.length > 0) return existente[0].id;
            const novoEvento = { data, eventName: '', responsible: '', notes: '' };
            const createResponse = await fetch(`${SUPABASE_URL}/rest/v1/eventos`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Prefer': 'return=representation' }, body: JSON.stringify(novoEvento) });
            if (!createResponse.ok) return null;
            const criado = await createResponse.json();
            return Array.isArray(criado) ? criado[0].id : criado.id;
        } catch (error) { console.error('❌ Erro:', error); return null; }
    },

    async atualizarEventoNoSupabase(data, campos) {
        try {
            const eventoId = await this.getOrCreateEventoId(data);
            if (!eventoId) throw new Error('Evento não encontrado');
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.EVENTOS}?id=eq.${eventoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ ...campos, updated_at: new Date().toISOString() }) });
            if (!response.ok) throw new Error('Erro ao atualizar evento');
            if (this.events[data]) this.events[data] = { ...this.events[data], ...campos, id: eventoId };
            localStorage.setItem('cantinaEvents', JSON.stringify(this.events));
        } catch (error) { console.error('Erro ao atualizar evento:', error); throw error; }
    },

    atualizarHeader() {
        const hoje = new Date();
        document.getElementById('headerDate').innerHTML = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    gerarCalendario() {
        const primeiroDia = new Date(this.currentYear, this.currentMonth, 1);
        const ultimoDia = new Date(this.currentYear, this.currentMonth + 1, 0);
        const diaSemanaInicio = primeiroDia.getDay();
        const totalDias = ultimoDia.getDate();
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        document.getElementById('monthYear').innerHTML = `${meses[this.currentMonth]} ${this.currentYear}`;
        let html = '';
        for (let i = 0; i < diaSemanaInicio; i++) html += '<div class="calendar-day" style="opacity:0.3"></div>';
        for (let dia = 1; dia <= totalDias; dia++) {
            const dataKey = `${this.currentYear}-${String(this.currentMonth+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
            const temEvento = this.events[dataKey];
            html += `<div class="calendar-day ${temEvento ? 'has-event' : ''}" onclick="app.abrirDia('${dataKey}')"><div class="day-number">${dia}</div>${temEvento ? '<div class="event-tag">' + (temEvento.eventName?.substring(0,5) || 'Evento') + '</div>' : ''}</div>`;
        }
        document.getElementById('calendarDays').innerHTML = html;
    },

    anteriorMes() { this.currentMonth--; if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; } this.gerarCalendario(); },
    proximoMes() { this.currentMonth++; if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; } this.gerarCalendario(); },

    async abrirDia(dataKey) {
        this.mostrarLoading();
        this.selectedDay = dataKey;
        if (!this.events[dataKey]) {
            this.events[dataKey] = { eventName: '', responsible: '', notes: '', producao: [], ingredientes: [], vendas: [], comprovantes: [] };
            await this.getOrCreateEventoId(dataKey);
        }
        const [ano, mes, dia] = dataKey.split('-');
        document.getElementById('selectedDate').innerHTML = `📅 ${dia}/${mes}/${ano}`;
        this.carregarDadosEvento();
        document.getElementById('calendarSection').classList.add('hidden');
        document.getElementById('managementSection').classList.remove('hidden');
        this.mudarAba('vendas');
        this.esconderLoading();
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
        
        const searchInput = document.getElementById('searchCliente');
        if (searchInput && !searchInput._listenerAdded) { searchInput.addEventListener('input', () => this.buscarVendas()); searchInput._listenerAdded = true; }
        this.filtroTipo = 'todos';
        document.querySelectorAll('.btn-filter').forEach(btn => { if (btn.getAttribute('data-filtro') === 'todos') btn.classList.add('active'); else btn.classList.remove('active'); });
        if (searchInput) searchInput.value = '';
        this.buscaCliente = '';
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
                document.getElementById('eventName').value = this.events[this.selectedDay].eventName || '';
                document.getElementById('responsible').value = this.events[this.selectedDay].responsible || '';
                document.getElementById('notes').value = this.events[this.selectedDay].notes || '';
            }
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

    async salvarEvento() {
        if (!this.selectedDay) { alert('Nenhum dia selecionado!'); return; }
        const eventName = document.getElementById('eventName').value;
        const responsible = document.getElementById('responsible').value;
        const notes = document.getElementById('notes').value;
        try {
            this.mostrarLoading();
            const eventoId = await this.getOrCreateEventoId(this.selectedDay);
            if (!eventoId) throw new Error('Não foi possível obter/criar o evento');
            const updateData = { eventName, responsible, notes, updated_at: new Date().toISOString() };
            const response = await fetch(`${SUPABASE_URL}/rest/v1/eventos?id=eq.${eventoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify(updateData) });
            if (!response.ok) throw new Error(`Erro ao atualizar evento: ${response.status}`);
            if (!this.events[this.selectedDay]) this.events[this.selectedDay] = { producao: [], ingredientes: [], vendas: [], comprovantes: [] };
            this.events[this.selectedDay].id = eventoId;
            this.events[this.selectedDay].eventName = eventName;
            this.events[this.selectedDay].responsible = responsible;
            this.events[this.selectedDay].notes = notes;
            localStorage.setItem('cantinaEvents', JSON.stringify(this.events));
            document.getElementById('selectedEventName').innerHTML = eventName || 'Novo Evento';
            document.getElementById('selectedResponsible').innerHTML = `👤 ${responsible || 'Clique para editar'}`;
            const btn = document.querySelector('.btn-primary[onclick="app.salvarEvento()"]');
            if (btn) { const originalText = btn.innerHTML; btn.innerHTML = '<span>✅</span> Salvo!'; btn.style.background = '#10b981'; setTimeout(() => { btn.innerHTML = originalText; btn.style.background = ''; }, 1500); }
        } catch (error) { console.error('Erro detalhado ao salvar evento:', error); alert(`Erro ao salvar evento: ${error.message}`); }
        finally { this.esconderLoading(); }
    },

    // ========== PRODUÇÃO (mantida igual) ==========
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
    cancelarFormProducao() { document.getElementById('formProducao').classList.add('hidden'); this.producaoEditando = null; this.limparFormProducao(); },
    limparFormProducao() { document.getElementById('producaoEditId').value = ''; document.getElementById('producaoNome').value = ''; document.getElementById('producaoQuantidade').value = ''; document.getElementById('producaoValor').value = ''; },
    async salvarProducao() {
        if (!this.selectedDay) return;
        const id = document.getElementById('producaoEditId').value;
        const nome = document.getElementById('producaoNome').value;
        const quantidade = parseInt(document.getElementById('producaoQuantidade').value) || 0;
        const valor = parseFloat(document.getElementById('producaoValor').value) || 0;
        if (!nome || quantidade <= 0 || valor <= 0) { alert('Preencha todos os campos corretamente!'); return; }
        try {
            this.mostrarLoading();
            const eventoId = await this.getOrCreateEventoId(this.selectedDay);
            if (!eventoId) throw new Error('Erro ao obter evento');
            let vendidoAtual = 0;
            if (this.producaoEditando) { const itemExistente = this.events[this.selectedDay]?.producao.find(p => String(p.id) === String(this.producaoEditando)); if (itemExistente) vendidoAtual = itemExistente.vendido || 0; }
            const producaoData = { evento_id: eventoId, nome, quantidade, valor, vendido: vendidoAtual };
            if (this.producaoEditando) await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.PRODUCAO}?id=eq.${this.producaoEditando}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify(producaoData) });
            else await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.PRODUCAO}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Prefer': 'return=representation' }, body: JSON.stringify(producaoData) });
            await this.carregarEventos();
            this.cancelarFormProducao();
            this.carregarDadosEvento();
        } catch (error) { console.error('Erro ao salvar produção:', error); alert(`Erro ao salvar: ${error.message}`); }
        finally { this.esconderLoading(); }
    },
    async removerProducao(id) {
        if (!confirm('Remover este prato?')) return;
        try {
            this.mostrarLoading();
            await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.PRODUCAO}?id=eq.${id}`, { method: 'DELETE', headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
            await this.carregarEventos();
            this.carregarDadosEvento();
        } catch (error) { console.error('Erro ao remover produção:', error); alert('Erro ao remover item!'); }
        finally { this.esconderLoading(); }
    },
    atualizarListaProducao() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;
        const producao = this.events[this.selectedDay].producao || [];
        let html = '', totalItens = 0;
        producao.sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
        producao.forEach(item => {
            const disponivel = item.quantidade - (item.vendido || 0);
            totalItens += disponivel;
            const valorTotalPotencial = item.quantidade * item.valor;
            const valorVendido = (item.vendido || 0) * item.valor;
            const valorDisponivel = disponivel * item.valor;
            html += `<div class="item-card" style="border-left-color:var(--success)"><div class="item-info"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span class="item-name">${item.nome}</span><span class="item-badge" style="background:var(--primary)">R$ ${item.valor.toFixed(2)}</span>${disponivel>0?`<span class="item-badge" style="background:var(--warning)">${disponivel} disponível</span>`:`<span class="item-badge" style="background:var(--danger)">Esgotado</span>`}</div><span class="item-details">Produzido: ${item.quantidade} • Vendido: ${item.vendido||0} • Disponível: ${disponivel}</span><div style="display:flex;gap:10px;margin-top:4px;font-size:0.8rem"><span>💰 Potencial: R$ ${valorTotalPotencial.toFixed(2)}</span><span>✅ Vendido: R$ ${valorVendido.toFixed(2)}</span><span>📦 A vender: R$ ${valorDisponivel.toFixed(2)}</span></div></div><div style="display:flex;align-items:center;gap:6px"><button class="btn-icon" style="background:var(--primary)" onclick="app.mostrarFormProducao('${item.id}')">✏️</button><button class="btn-icon" style="background:var(--danger)" onclick="app.removerProducao('${item.id}')">🗑️</button></div></div>`;
        });
        document.getElementById('producaoList').innerHTML = html || '<div style="text-align:center;padding:20px;color:var(--text-light)">Nenhum prato cadastrado</div>';
        document.getElementById('totalItensProducao').innerHTML = totalItens;
    },
    atualizarSelectProdutos() {
        const select = document.getElementById('vendaProdutoId');
        if (!select) return;
        const producao = this.events[this.selectedDay]?.producao || [];
        let options = '<option value="">Selecione um prato</option>';
        producao.forEach(item => { const disponivel = item.quantidade - (item.vendido || 0); if (disponivel > 0) options += `<option value="${item.id}">${item.nome} - R$ ${item.valor.toFixed(2)} (${disponivel} disp)</option>`; });
        select.innerHTML = options;
    },
    carregarDadosProduto() {
        const select = document.getElementById('vendaProdutoId');
        const produtoId = select.value;
        if (!produtoId) { document.getElementById('vendaValorUnit').value = ''; document.getElementById('vendaDisponivel').value = ''; return; }
        const produto = this.events[this.selectedDay].producao.find(p => String(p.id) === String(produtoId));
        if (produto) {
            const disponivel = produto.quantidade - (produto.vendido || 0);
            document.getElementById('vendaValorUnit').value = produto.valor;
            document.getElementById('vendaDisponivel').value = disponivel;
            document.getElementById('vendaQtd').max = disponivel;
            this.calcularTotalVenda();
        }
    },

    // ========== INGREDIENTES (mantido) ==========
    mostrarFormIngrediente(ingredienteId = null) {
        this.ingredienteEditando = ingredienteId;
        const modalTitle = document.getElementById('ingredienteModalTitle');
        this.limparFormIngrediente();
        if (ingredienteId) {
            modalTitle.innerHTML = '✏️ Editar Ingrediente';
            const ingrediente = this.events[this.selectedDay].ingredientes.find(i => String(i.id) === String(ingredienteId));
            if (ingrediente) {
                document.getElementById('ingredienteEditId').value = ingrediente.id;
                document.getElementById('ingredienteNome').value = ingrediente.nome;
                document.getElementById('ingredienteQtd').value = ingrediente.quantidade;
                document.getElementById('ingredienteUnidade').value = ingrediente.unidade;
                document.getElementById('ingredienteValor').value = ingrediente.valorTotal;
                document.getElementById('ingredienteComprado').checked = ingrediente.comprado;
                document.getElementById('ingredienteDoacao').checked = ingrediente.doacao;
                if (ingrediente.comprovante_id) document.getElementById('ingredienteComprovanteId').value = ingrediente.comprovante_id;
            }
        } else modalTitle.innerHTML = '➕ Ingrediente';
        this.atualizarSelectComprovantes();
        document.getElementById('formIngrediente').classList.remove('hidden');
    },
    atualizarSelectComprovantes() {
        const select = document.getElementById('ingredienteComprovanteId');
        if (!select) return;
        select.innerHTML = '<option value="">Nenhum</option>';
        const comprovantes = this.events[this.selectedDay]?.comprovantes || [];
        comprovantes.forEach(comp => { const opt = document.createElement('option'); opt.value = comp.id; opt.textContent = `${comp.nome} (R$ ${(comp.valorTotal||0).toFixed(2)})`; select.appendChild(opt); });
        const container = document.getElementById('comprovanteSelectContainer');
        if (container) container.style.display = comprovantes.length > 0 ? 'block' : 'none';
    },
    cancelarFormIngrediente() { document.getElementById('formIngrediente').classList.add('hidden'); this.ingredienteEditando = null; this.limparFormIngrediente(); },
    limparFormIngrediente() {
        document.getElementById('ingredienteEditId').value = ''; document.getElementById('ingredienteNome').value = ''; document.getElementById('ingredienteQtd').value = '';
        document.getElementById('ingredienteUnidade').value = 'un'; document.getElementById('ingredienteValor').value = ''; document.getElementById('ingredienteComprado').checked = false;
        document.getElementById('ingredienteDoacao').checked = false; document.getElementById('ingredienteComprovanteId').value = '';
        const preview = document.getElementById('previewImage'); if (preview) { preview.src = '#'; preview.style.display = 'none'; }
    },
    async salvarIngrediente() {
        if (!this.selectedDay) return;
        const id = document.getElementById('ingredienteEditId').value;
        const nome = document.getElementById('ingredienteNome').value;
        const quantidade = parseFloat(document.getElementById('ingredienteQtd').value) || 0;
        const unidade = document.getElementById('ingredienteUnidade').value;
        const valorTotal = parseFloat(document.getElementById('ingredienteValor').value) || 0;
        const comprado = document.getElementById('ingredienteComprado').checked;
        const doacao = document.getElementById('ingredienteDoacao').checked;
        const comprovanteId = document.getElementById('ingredienteComprovanteId').value || null;
        if (!nome || quantidade <= 0) { alert('Preencha todos os campos corretamente!'); return; }
        try {
            this.mostrarLoading();
            const eventoId = await this.getOrCreateEventoId(this.selectedDay);
            if (!eventoId) throw new Error('Erro ao obter evento');
            const ingredienteData = { evento_id: eventoId, nome, quantidade, unidade, valorTotal, comprado, doacao, comprovante_id: comprovanteId };
            if (this.ingredienteEditando) await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}?id=eq.${this.ingredienteEditando}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify(ingredienteData) });
            else await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Prefer': 'return=representation' }, body: JSON.stringify(ingredienteData) });
            await this.carregarEventos();
            this.cancelarFormIngrediente();
            this.carregarDadosEvento();
        } catch (error) { console.error('Erro ao salvar ingrediente:', error); alert('Erro ao salvar no banco de dados'); }
        finally { this.esconderLoading(); }
    },
    async removerIngrediente(id) {
        if (!confirm('Remover este ingrediente?')) return;
        try {
            this.mostrarLoading();
            await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}?id=eq.${id}`, { method: 'DELETE', headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
            await this.carregarEventos();
            this.carregarDadosEvento();
        } catch (error) { console.error('Erro ao remover ingrediente:', error); alert('Erro ao remover item!'); }
        finally { this.esconderLoading(); }
    },
    async toggleCompradoIngrediente(id) {
        try {
            this.mostrarLoading();
            const ingrediente = this.events[this.selectedDay].ingredientes.find(i => String(i.id) === String(id));
            if (ingrediente) {
                await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}?id=eq.${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ comprado: !ingrediente.comprado }) });
                await this.carregarEventos();
                this.carregarDadosEvento();
            }
        } catch (error) { console.error('Erro ao atualizar ingrediente:', error); alert('Erro ao atualizar!'); }
        finally { this.esconderLoading(); }
    },
    atualizarListaIngredientes() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;
        const ingredientes = this.events[this.selectedDay].ingredientes || [];
        const comprovantes = this.events[this.selectedDay].comprovantes || [];
        let html = '';
        ingredientes.sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
        ingredientes.forEach(item => {
            const compradoClass = item.comprado ? 'comprado' : '';
            const compradoText = item.comprado ? '✅' : '⏳';
            const valorDisplay = item.valorTotal > 0 ? `R$ ${item.valorTotal.toFixed(2)}` : '💰 A definir';
            const temComprovante = !!item.comprovante_id;
            const comprovante = temComprovante ? comprovantes.find(c => String(c.id) === String(item.comprovante_id)) : null;
            html += `<div class="item-card ${compradoClass}" data-id="${item.id}" style="${item.comprado ? 'opacity:0.8' : ''}"><div class="item-info"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span class="item-name">${item.nome}</span>${item.doacao?'<span class="item-badge">🎁 Doação</span>':''}${item.comprado?'<span class="item-badge" style="background:var(--success)">✓ Comprado</span>':''}${item.valorTotal===0 && !item.doacao?'<span class="item-badge" style="background:var(--warning)">⏳ Pendente</span>':''}${temComprovante?'<span class="item-badge" style="background:var(--primary)">📎 Comprovante</span>':''}</div><span class="item-details">${item.quantidade||0} ${item.unidade||'un'} • ${valorDisplay}</span>${temComprovante?`<div style="display:flex;align-items:center;gap:4px;margin-top:4px"><span class="item-details" style="color:var(--primary)">📎 ${comprovante?.nome||'Comprovante'}</span><button class="btn-icon" style="background:var(--primary);width:24px;height:24px;font-size:0.8rem" onclick="app.verComprovanteDoIngrediente('${item.comprovante_id}')">👁️</button></div>`:''}</div><div style="display:flex;align-items:center;gap:6px"><button class="btn-icon" style="background:var(--success)" onclick="app.toggleCompradoIngrediente('${item.id}')">${compradoText}</button><button class="btn-icon" style="background:var(--primary)" onclick="app.mostrarFormIngrediente('${item.id}')">✏️</button><button class="btn-icon" style="background:var(--danger)" onclick="app.removerIngrediente('${item.id}')">🗑️</button></div></div>`;
        });
        document.getElementById('ingredientesList').innerHTML = html || '<div style="text-align:center;padding:20px;color:var(--text-light)">Nenhum ingrediente</div>';
    },
    verComprovanteDoIngrediente(comprovanteId) { if (!comprovanteId) return; const comprovante = this.events[this.selectedDay].comprovantes.find(c => String(c.id)===String(comprovanteId)); this.mostrarComprovanteEmJanela(comprovante); },

    // ========== COMPROVANTES (mantido) ==========
    mostrarFormComprovante(comprovanteId = null) {
        this.comprovanteEditando = comprovanteId;
        this.ingredientesSelecionados = [];
        this.limparFormComprovante();
        if (comprovanteId) {
            const comprovante = this.events[this.selectedDay].comprovantes.find(c => String(c.id) === String(comprovanteId));
            if (comprovante) {
                document.getElementById('comprovanteEditId').value = comprovante.id;
                document.getElementById('comprovanteNome').value = comprovante.nome;
                document.getElementById('comprovanteData').value = comprovante.data;
                document.getElementById('comprovanteValor').value = comprovante.valorTotal;
                if (comprovante.imagem) { const preview = document.getElementById('previewImage'); preview.src = comprovante.imagem; preview.style.display = 'block'; }
                const ingredientes = this.events[this.selectedDay].ingredientes || [];
                this.ingredientesSelecionados = ingredientes.filter(i => String(i.comprovante_id) === String(comprovante.id)).map(i => String(i.id));
            }
        }
        this.atualizarListaIngredientesParaComprovante();
        document.getElementById('formComprovante').classList.remove('hidden');
    },
    atualizarListaIngredientesParaComprovante() {
        const container = document.getElementById('comprovanteItensList');
        if (!container) return;
        const ingredientes = this.events[this.selectedDay]?.ingredientes || [];
        if (ingredientes.length === 0) { container.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:10px">Nenhum ingrediente cadastrado</p>'; return; }
        let html = '';
        ingredientes.sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
        ingredientes.forEach(item => {
            const itemId = String(item.id);
            const estaSelecionado = this.ingredientesSelecionados.includes(itemId);
            const valorDisplay = item.valorTotal > 0 ? `R$ ${item.valorTotal.toFixed(2)}` : '💰 A definir';
            html += `<div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);background:${estaSelecionado?'rgba(249,115,22,0.1)':'transparent'}"><input type="checkbox" id="ingrediente_${itemId}" value="${itemId}" ${estaSelecionado?'checked':''} onchange="app.toggleIngredienteComprovante('${itemId}')" style="width:20px;height:20px;cursor:pointer"><div style="flex:1"><div style="font-weight:600">${item.nome}</div><div style="font-size:0.8rem;color:var(--text-light)">${item.quantidade} ${item.unidade} • ${valorDisplay}</div></div></div>`;
        });
        container.innerHTML = html;
    },
    toggleIngredienteComprovante(ingredienteId) {
        const index = this.ingredientesSelecionados.indexOf(String(ingredienteId));
        if (index === -1) this.ingredientesSelecionados.push(String(ingredienteId));
        else this.ingredientesSelecionados.splice(index,1);
        const checkbox = document.getElementById(`ingrediente_${ingredienteId}`);
        if (checkbox) {
            checkbox.checked = (index === -1);
            const itemDiv = checkbox.closest('div[style*="display: flex"]');
            if(itemDiv) itemDiv.style.background = (index === -1) ? 'rgba(249,115,22,0.1)' : 'transparent';
        }
    },
    cancelarFormComprovante() { document.getElementById('formComprovante').classList.add('hidden'); this.comprovanteEditando = null; this.ingredientesSelecionados = []; this.limparFormComprovante(); },
    limparFormComprovante() { document.getElementById('comprovanteEditId').value = ''; document.getElementById('comprovanteNome').value = ''; document.getElementById('comprovanteData').value = ''; document.getElementById('comprovanteValor').value = ''; document.getElementById('comprovanteImagem').value = ''; const preview = document.getElementById('previewImage'); preview.src = '#'; preview.style.display = 'none'; },
    async comprimirImagem(file, maxWidth=1024, qualidade=0.7) {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = e => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width, height = img.height;
                    if(width > maxWidth) { height = Math.round(height * (maxWidth/width)); width = maxWidth; }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0,width,height);
                    resolve(canvas.toDataURL('image/jpeg', qualidade));
                };
            };
        });
    },
    async salvarComprovante() {
        if (!this.selectedDay) return;
        const id = document.getElementById('comprovanteEditId').value;
        const nome = document.getElementById('comprovanteNome').value;
        const data = document.getElementById('comprovanteData').value;
        const valorTotal = parseFloat(document.getElementById('comprovanteValor').value) || 0;
        const imagemInput = document.getElementById('comprovanteImagem');
        let imagem = null;
        if(imagemInput.files && imagemInput.files[0]) imagem = await this.comprimirImagem(imagemInput.files[0],1024,0.7);
        if(!nome) { alert('Digite o nome do comprovante!'); return; }
        try {
            this.mostrarLoading();
            const eventoId = await this.getOrCreateEventoId(this.selectedDay);
            if(!eventoId) throw new Error('Erro ao obter evento');
            const comprovanteData = { evento_id: eventoId, nome, data, valorTotal, imagem: imagem || (this.comprovanteEditando ? this.events[this.selectedDay].comprovantes.find(c => String(c.id)===String(this.comprovanteEditando))?.imagem : null) };
            let comprovanteId = id;
            if(this.comprovanteEditando) {
                await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.COMPROVANTES}?id=eq.${this.comprovanteEditando}`, { method:'PATCH', headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}`}, body:JSON.stringify(comprovanteData) });
                comprovanteId = this.comprovanteEditando;
            } else {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.COMPROVANTES}`, { method:'POST', headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}`,'Prefer':'return=representation'}, body:JSON.stringify(comprovanteData) });
                if(!response.ok) throw new Error('Erro ao criar comprovante');
                const novo = await response.json();
                comprovanteId = Array.isArray(novo) ? novo[0].id : novo.id;
            }
            if(this.ingredientesSelecionados.length > 0) {
                if(this.comprovanteEditando) await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}?comprovante_id=eq.${this.comprovanteEditando}`, { method:'PATCH', headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}`}, body:JSON.stringify({ comprovante_id: null }) });
                for(const ingId of this.ingredientesSelecionados) {
                    await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}?id=eq.${ingId}`, { method:'PATCH', headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}`}, body:JSON.stringify({ comprovante_id: comprovanteId }) });
                }
            }
            await this.carregarEventos();
            this.cancelarFormComprovante();
            this.carregarDadosEvento();
        } catch(error) { console.error('Erro ao salvar comprovante:', error); alert('Erro ao salvar no banco de dados'); }
        finally { this.esconderLoading(); }
    },
    async removerComprovante(id) {
        if(!confirm('Remover este comprovante? Os itens vinculados serão desvinculados.')) return;
        try {
            this.mostrarLoading();
            await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}?comprovante_id=eq.${id}`, { method:'PATCH', headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}`}, body:JSON.stringify({ comprovante_id: null }) });
            await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.COMPROVANTES}?id=eq.${id}`, { method:'DELETE', headers:{'apikey':SUPABASE_ANON_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}`} });
            await this.carregarEventos();
            this.carregarDadosEvento();
        } catch(error) { console.error('Erro ao remover comprovante:', error); alert('Erro ao remover comprovante!'); }
        finally { this.esconderLoading(); }
    },
    atualizarListaComprovantes() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;
        const comprovantes = this.events[this.selectedDay].comprovantes || [];
        const ingredientes = this.events[this.selectedDay].ingredientes || [];
        let html = '';
        comprovantes.forEach(comp => {
            const itensVinculados = ingredientes.filter(i => String(i.comprovante_id) === String(comp.id));
            const totalItens = itensVinculados.length;
            const totalValorItens = itensVinculados.reduce((acc,item) => acc + (item.valorTotal||0),0);
            const itensList = itensVinculados.map(item => `<div style="font-size:0.7rem;color:var(--text-light);margin-left:10px">• ${item.nome} - R$ ${(item.valorTotal||0).toFixed(2)}</div>`).join('');
            html += `<div class="item-card" style="border-left-color:var(--success)"><div class="item-info"><div style="display:flex;align-items:center;gap:6px"><span class="item-name">📎 ${comp.nome}</span><span class="item-badge" style="background:var(--primary)">${totalItens} itens</span></div><span class="item-details">${comp.data||'Sem data'} • R$ ${(comp.valorTotal||0).toFixed(2)}</span><span class="item-details">Valor nos itens: R$ ${totalValorItens.toFixed(2)}</span>${totalItens>0?`<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)"><div style="font-weight:600;font-size:0.8rem;margin-bottom:4px">Itens neste comprovante:</div>${itensList}</div>`:''}</div><div style="display:flex;align-items:center;gap:6px"><button class="btn-icon" style="background:var(--primary)" onclick="app.verComprovante('${comp.id}')">👁️</button><button class="btn-icon" style="background:var(--warning)" onclick="app.mostrarFormComprovante('${comp.id}')">✏️</button><button class="btn-icon" style="background:var(--danger)" onclick="app.removerComprovante('${comp.id}')">🗑️</button></div></div>`;
        });
        document.getElementById('comprovantesList').innerHTML = html || '<div style="text-align:center;padding:20px;color:var(--text-light)">Nenhum comprovante</div>';
    },
    verComprovante(id) { const comprovante = this.events[this.selectedDay].comprovantes.find(c => String(c.id)===String(id)); this.mostrarComprovanteEmJanela(comprovante); },
    mostrarComprovanteEmJanela(comprovante) {
        if(!comprovante?.imagem) { alert('Este comprovante não possui imagem!'); return; }
        const ingredientes = this.events[this.selectedDay].ingredientes || [];
        const itensVinculados = ingredientes.filter(i => String(i.comprovante_id) === String(comprovante.id));
        const win = window.open();
        win.document.write(`<html><head><title>${comprovante.nome}</title><style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#f0f0f0;font-family:Arial,sans-serif;padding:20px;}.container{max-width:90%;background:white;padding:20px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}.header{margin-bottom:20px;padding-bottom:10px;border-bottom:1px solid #eee;}.header h2{margin:0;color:#f97316;}.header p{margin:5px 0 0;color:#666;}.itens-list{margin:20px 0;padding:15px;background:#f9f9f9;border-radius:8px;}.itens-list h3{margin:0 0 10px;font-size:1rem;}.itens-list ul{margin:0;padding-left:20px;}img{max-width:100%;max-height:60vh;object-fit:contain;border-radius:8px;margin-top:15px;}</style></head><body><div class="container"><div class="header"><h2>📎 ${comprovante.nome}</h2><p>Data: ${comprovante.data||'Não informada'} • Valor Total: R$ ${(comprovante.valorTotal||0).toFixed(2)}</p></div>${itensVinculados.length>0?`<div class="itens-list"><h3>🛒 Itens neste comprovante:</h3><ul>${itensVinculados.map(item=>`<li>${item.nome} - ${item.quantidade} ${item.unidade} - R$ ${(item.valorTotal||0).toFixed(2)}</li>`).join('')}</ul></div>`:''}<img src="${comprovante.imagem}" alt="Comprovante"></div></body></html>`);
    },

    // ========== VENDAS COM TIPO E STATUS SEPARADOS ==========
    mostrarFormVenda() { this.atualizarSelectProdutos(); document.getElementById('formVenda').classList.remove('hidden'); this.limparFormVenda(); },
    cancelarFormVenda() { document.getElementById('formVenda').classList.add('hidden'); this.vendaEditando = null; },
    limparFormVenda() {
        document.getElementById('vendaCliente').value = '';
        document.getElementById('vendaProdutoId').value = '';
        document.getElementById('vendaQtd').value = '1';
        document.getElementById('vendaValorUnit').value = '';
        document.getElementById('vendaTotal').value = '';
        document.getElementById('vendaTipoPedido').value = 'retirada';
        document.getElementById('vendaFormaPagamento').value = 'dinheiro';
        document.getElementById('vendaValorPago').value = '';
        document.getElementById('vendaObs').value = '';
        document.getElementById('vendaDisponivel').value = '';
        document.getElementById('vendaPendente').value = 'R$ 0,00';
    },
    calcularTotalVenda() { const qtd = parseFloat(document.getElementById('vendaQtd').value)||0; const valorUnit = parseFloat(document.getElementById('vendaValorUnit').value)||0; const total = qtd*valorUnit; document.getElementById('vendaTotal').value = total.toFixed(2); this.calcularPendenteVenda(); },
    calcularPendenteVenda() { const total = parseFloat(document.getElementById('vendaTotal').value)||0; const pago = parseFloat(document.getElementById('vendaValorPago').value)||0; const pendente = total - pago; document.getElementById('vendaPendente').value = `R$ ${pendente.toFixed(2)}`; },
    
    async salvarVenda() {
        if (!this.selectedDay) return;
        const cliente = document.getElementById('vendaCliente').value;
        const produtoId = document.getElementById('vendaProdutoId').value;
        const quantidade = parseInt(document.getElementById('vendaQtd').value)||0;
        const valorUnit = parseFloat(document.getElementById('vendaValorUnit').value)||0;
        const tipoPedido = document.getElementById('vendaTipoPedido').value; // 'entrega' ou 'retirada'
        const formaPagamento = document.getElementById('vendaFormaPagamento').value;
        const valorPago = parseFloat(document.getElementById('vendaValorPago').value)||0;
        const observacoes = document.getElementById('vendaObs').value;
        // Status entregue padrão false
        const entregue = false;
        if (!cliente) { alert('Digite o nome do cliente!'); return; }
        if (!this.vendaEditando && (!produtoId || quantidade <= 0)) { alert('Selecione um produto e quantidade válida!'); return; }
        if (!this.vendaEditando) {
            const produto = this.events[this.selectedDay].producao.find(p => String(p.id) === String(produtoId));
            const disponivel = produto.quantidade - (produto.vendido || 0);
            if (quantidade > disponivel) { alert(`Quantidade indisponível! Disponível: ${disponivel}`); return; }
        }
        try {
            this.mostrarLoading();
            const eventoId = await this.getOrCreateEventoId(this.selectedDay);
            if (!eventoId) throw new Error('Erro ao obter evento');
            if (this.vendaEditando) {
                const vendaAntiga = this.events[this.selectedDay].vendas.find(v => String(v.id) === String(this.vendaEditando));
                const vendaData = { evento_id: eventoId, cliente, produtoId: vendaAntiga.produtoId, produtoNome: vendaAntiga.produtoNome, quantidade: vendaAntiga.quantidade, valorUnit: vendaAntiga.valorUnit, tipo_pedido: vendaAntiga.tipo_pedido, formaPagamento, valorPago, entregue: vendaAntiga.entregue, observacoes, data: vendaAntiga.data };
                if (produtoId && produtoId !== vendaAntiga.produtoId) {
                    const novoProduto = this.events[this.selectedDay].producao.find(p => String(p.id) === String(produtoId));
                    vendaData.produtoId = produtoId;
                    vendaData.produtoNome = novoProduto.nome;
                    vendaData.quantidade = quantidade;
                    vendaData.valorUnit = valorUnit;
                }
                // Se tipoPedido mudou, atualizar
                vendaData.tipo_pedido = tipoPedido;
                await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.VENDAS}?id=eq.${this.vendaEditando}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify(vendaData) });
                if (produtoId && (produtoId !== vendaAntiga.produtoId || quantidade !== vendaAntiga.quantidade)) {
                    const outrasVendasAntigo = this.events[this.selectedDay].vendas.filter(v => String(v.id) !== String(this.vendaEditando) && String(v.produtoId) === String(vendaAntiga.produtoId));
                    const totalVendidoAntigo = outrasVendasAntigo.reduce((acc, v) => acc + v.quantidade, 0);
                    await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.PRODUCAO}?id=eq.${vendaAntiga.produtoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ vendido: totalVendidoAntigo }) });
                    const outrasVendasNovo = this.events[this.selectedDay].vendas.filter(v => String(v.id) !== String(this.vendaEditando) && String(v.produtoId) === String(produtoId));
                    const totalVendidoNovo = outrasVendasNovo.reduce((acc, v) => acc + v.quantidade, 0) + quantidade;
                    await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.PRODUCAO}?id=eq.${produtoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ vendido: totalVendidoNovo }) });
                }
            } else {
                const produto = this.events[this.selectedDay].producao.find(p => String(p.id) === String(produtoId));
                const vendaData = { evento_id: eventoId, cliente, produtoId, produtoNome: produto.nome, quantidade, valorUnit, tipo_pedido: tipoPedido, formaPagamento, valorPago, entregue, observacoes, data: new Date().toISOString() };
                await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.VENDAS}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Prefer': 'return=representation' }, body: JSON.stringify(vendaData) });
                const todasVendas = [...(this.events[this.selectedDay].vendas || []), vendaData];
                const vendasDoProduto = todasVendas.filter(v => String(v.produtoId) === String(produtoId));
                const totalVendido = vendasDoProduto.reduce((acc, v) => acc + v.quantidade, 0);
                await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.PRODUCAO}?id=eq.${produtoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ vendido: totalVendido }) });
            }
            await this.carregarEventos();
            this.cancelarFormVenda();
            this.carregarDadosEvento();
        } catch (error) { console.error('Erro ao salvar venda:', error); alert(`Erro ao salvar: ${error.message}`); }
        finally { this.esconderLoading(); }
    },
    
    async removerVenda(id) {
        if (!confirm('Remover esta venda?')) return;
        try {
            this.mostrarLoading();
            const venda = this.events[this.selectedDay].vendas.find(v => String(v.id) === String(id));
            if (venda) {
                const produto = this.events[this.selectedDay].producao.find(p => String(p.id) === String(venda.produtoId));
                if (produto) {
                    const novoVendido = (produto.vendido || 0) - venda.quantidade;
                    await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.PRODUCAO}?id=eq.${venda.produtoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ vendido: novoVendido }) });
                }
            }
            await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.VENDAS}?id=eq.${id}`, { method: 'DELETE', headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
            await this.carregarEventos();
            this.carregarDadosEvento();
        } catch (error) { console.error('Erro ao remover venda:', error); alert('Erro ao remover venda!'); }
        finally { this.esconderLoading(); }
    },
    
    atualizarListaVendas() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;
        let vendas = this.events[this.selectedDay].vendas || [];
        // Filtrar por tipo de pedido (entrega/retirada)
        if (this.filtroTipo === 'entrega') vendas = vendas.filter(v => v.tipo_pedido === 'entrega');
        else if (this.filtroTipo === 'retirada') vendas = vendas.filter(v => v.tipo_pedido === 'retirada');
        // Buscar por cliente
        if (this.buscaCliente.trim() !== '') {
            const termo = this.buscaCliente.toLowerCase().trim();
            vendas = vendas.filter(v => v.cliente.toLowerCase().includes(termo));
        }
        // Ordenar alfabeticamente
        vendas.sort((a,b) => (a.cliente||'').localeCompare(b.cliente||''));
        let html = '';
        vendas.forEach(venda => {
            const valorTotal = venda.quantidade * venda.valorUnit;
            const pendente = valorTotal - (venda.valorPago || 0);
            const tipoTexto = venda.tipo_pedido === 'entrega' ? '🚚 Entrega' : '🏬 Retirada';
            const tipoClasse = venda.tipo_pedido === 'entrega' ? 'entrega' : 'retirada';
            const statusTexto = venda.entregue ? (venda.tipo_pedido === 'entrega' ? '✅ Entregue' : '✅ Retirado') : '⏳ Pendente';
            const statusClasse = venda.entregue ? 'entregue' : 'pendente';
            html += `<div class="venda-card" data-id="${venda.id}">
                        <div class="venda-header">
                            <div><span class="cliente-nome">${this.escapeHtml(venda.cliente)}</span><span class="status-badge ${statusClasse}">${statusTexto}</span></div>
                            <span class="entrega-badge ${tipoClasse}">${tipoTexto}</span>
                        </div>
                        <div class="venda-produto">${venda.produtoNome} • ${venda.quantidade}x R$ ${venda.valorUnit.toFixed(2)}</div>
                        <div class="venda-pagamento">
                            <div>Total:<br><strong>R$ ${valorTotal.toFixed(2)}</strong></div>
                            <div>Pago:<br><strong>R$ ${(venda.valorPago || 0).toFixed(2)}</strong></div>
                            <div>Falta:<br><strong class="${pendente > 0 ? 'warning' : 'success'}">R$ ${pendente.toFixed(2)}</strong></div>
                            <div>Forma:<br><strong>${venda.formaPagamento?.replace('_',' ') || ''}</strong></div>
                        </div>
                        <div class="venda-actions">
                            ${pendente > 0 ? `<button class="btn btn-success btn-sm" onclick="app.abrirPagamento('${venda.id}')">💰 Pagar</button>` : ''}
                            ${!venda.entregue ? `<button class="btn btn-success btn-sm" style="background:#10b981" onclick="app.marcarEntregue('${venda.id}')">${venda.tipo_pedido === 'entrega' ? '✅ Marcar Entregue' : '✅ Marcar Retirado'}</button>` : ''}
                            <button class="btn btn-outline btn-sm" onclick="app.editarVenda('${venda.id}')">✏️</button>
                            <button class="btn btn-danger btn-sm" onclick="app.removerVenda('${venda.id}')">🗑️</button>
                        </div>
                    </div>`;
        });
        document.getElementById('vendasList').innerHTML = html || '<div style="text-align:center;padding:30px;color:var(--text-light)">Nenhuma venda encontrada</div>';
    },
    
    escapeHtml(text) { if(!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; },
    
    filtrarPorTipo(tipo) {
        this.filtroTipo = tipo;
        document.querySelectorAll('.btn-filter').forEach(btn => {
            const filtro = btn.getAttribute('data-filtro');
            if (filtro === tipo) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        this.atualizarListaVendas();
    },
    
    buscarVendas() {
        const input = document.getElementById('searchCliente');
        this.buscaCliente = input ? input.value : '';
        this.atualizarListaVendas();
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
    cancelarPagamento() { document.getElementById('formPagamento').classList.add('hidden'); this.pagamentoVendaId = null; },
    async registrarPagamento() {
        if (this.pagamentoVendaId === null || !this.selectedDay) return;
        const valor = parseFloat(document.getElementById('pagamentoValor').value) || 0;
        const forma = document.getElementById('pagamentoForma').value;
        if (valor <= 0) { alert('Digite um valor válido!'); return; }
        try {
            this.mostrarLoading();
            const venda = this.events[this.selectedDay].vendas.find(v => String(v.id) === String(this.pagamentoVendaId));
            if (!venda) return;
            const total = venda.quantidade * venda.valorUnit;
            const novoPago = (venda.valorPago || 0) + valor;
            if (novoPago > total) { alert('Valor maior que o total!'); return; }
            await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.VENDAS}?id=eq.${this.pagamentoVendaId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ valorPago: novoPago, formaPagamento: forma }) });
            await this.carregarEventos();
            this.cancelarPagamento();
            this.carregarDadosEvento();
        } catch (error) { console.error('Erro ao registrar pagamento:', error); alert('Erro ao registrar pagamento!'); }
        finally { this.esconderLoading(); }
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
        document.getElementById('vendaTipoPedido').value = venda.tipo_pedido || 'retirada';
        document.getElementById('vendaFormaPagamento').value = venda.formaPagamento || 'dinheiro';
        document.getElementById('vendaValorPago').value = venda.valorPago || 0;
        document.getElementById('vendaObs').value = venda.observacoes || '';
        this.carregarDadosProduto();
        this.calcularPendenteVenda();
        document.getElementById('formVenda').classList.remove('hidden');
    },
    async marcarEntregue(id) {
        const venda = this.events[this.selectedDay].vendas.find(v => String(v.id) === String(id));
        if (!venda) return;
        const confirmMsg = venda.tipo_pedido === 'entrega' ? 'Marcar este pedido como ENTREGUE?' : 'Marcar este pedido como RETIRADO?';
        if (!confirm(confirmMsg)) return;
        try {
            this.mostrarLoading();
            await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.VENDAS}?id=eq.${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ entregue: true }) });
            await this.carregarEventos();
            this.carregarDadosEvento();
        } catch (error) { console.error('Erro ao marcar entregue/retirado:', error); alert('Erro ao atualizar!'); }
        finally { this.esconderLoading(); }
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
        const totalComprado = ingredientes.filter(item => item.comprado && !item.doacao && item.valorTotal > 0).reduce((acc, item) => acc + (item.valorTotal || 0), 0);
        const itensComprados = ingredientes.filter(item => item.comprado).length;
        const itensSemValor = ingredientes.filter(item => (item.valorTotal === 0 || !item.valorTotal) && !item.doacao).length;
        const totalProduzido = producao.reduce((acc, item) => acc + item.quantidade, 0);
        const totalVendidos = producao.reduce((acc, item) => acc + (item.vendido || 0), 0);
        const totalRestantes = totalProduzido - totalVendidos;
        let totalVendas = 0, totalRecebido = 0, totalDinheiro = 0, totalPixVeri = 0, totalPixJheni = 0, totalDebito = 0, totalEntregues = 0;
        vendas.forEach(venda => {
            const valorTotal = venda.quantidade * venda.valorUnit;
            totalVendas += valorTotal;
            totalRecebido += venda.valorPago || 0;
            if (venda.entregue) totalEntregues++;
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
        document.getElementById('relItensProduzidos').innerHTML = totalProduzido;
        document.getElementById('relItensVendidos').innerHTML = totalVendidos;
        document.getElementById('relItensRestantes').innerHTML = totalRestantes;
        document.getElementById('relItensComprados').innerHTML = itensComprados;
        document.getElementById('relTotalComprovantes').innerHTML = comprovantes.length;
        document.getElementById('relTotalComprado').innerHTML = `R$ ${totalComprado.toFixed(2)}`;
        let semValorRow = document.getElementById('relItensSemValor');
        if (semValorRow) semValorRow.querySelector('.report-value').innerHTML = itensSemValor;
    },

    // ========== NAVEGAÇÃO ==========
    async excluirEvento() {
        if (!this.selectedDay) return;
        if (!confirm('🗑️ Excluir este evento permanentemente?')) return;
        try {
            this.mostrarLoading();
            const evento = this.events[this.selectedDay];
            if (evento && evento.id) await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.EVENTOS}?id=eq.${evento.id}`, { method: 'DELETE', headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
            delete this.events[this.selectedDay];
            localStorage.setItem('cantinaEvents', JSON.stringify(this.events));
            this.voltarCalendario();
        } catch (error) { console.error('Erro ao excluir evento:', error); alert('Erro ao excluir evento!'); }
        finally { this.esconderLoading(); }
    },
    voltarCalendario() { document.getElementById('calendarSection').classList.remove('hidden'); document.getElementById('managementSection').classList.add('hidden'); this.gerarCalendario(); },
    mostrarCalendario() { document.getElementById('calendarSection').classList.remove('hidden'); document.getElementById('managementSection').classList.add('hidden'); this.gerarCalendario(); document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active')); document.querySelector('.nav-item:first-child').classList.add('active'); },
    novaCantinaHoje() { const hoje = new Date(); const dataKey = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`; this.abrirDia(dataKey); },
    mostrarCantinaHoje() { this.novaCantinaHoje(); document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active')); document.querySelector('.nav-item:nth-child(2)').classList.add('active'); },
    mostrarRelatorioGeral() {
        const totalEventos = Object.keys(this.events).length;
        let totalVendas = 0, totalRecebido = 0, totalCustos = 0;
        Object.values(this.events).forEach(evento => {
            if (evento.vendas) evento.vendas.forEach(venda => { totalVendas += venda.quantidade * venda.valorUnit; totalRecebido += venda.valorPago || 0; });
            if (evento.ingredientes) evento.ingredientes.forEach(ing => { if (!ing.doacao) totalCustos += ing.valorTotal || 0; });
        });
        alert(`📊 RELATÓRIO GERAL\n\nEventos: ${totalEventos}\nVendas: R$ ${totalVendas.toFixed(2)}\nRecebido: R$ ${totalRecebido.toFixed(2)}\nCustos: R$ ${totalCustos.toFixed(2)}\nLucro: R$ ${(totalVendas - totalCustos).toFixed(2)}`);
        document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active')); document.querySelector('.nav-item:last-child').classList.add('active');
    }
};

const app = App;
app.init();
