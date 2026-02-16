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
    comprovanteEditando: null,
    carregando: false,

    async init() {
        this.mostrarLoading();
        await this.carregarEventos();
        this.atualizarHeader();
        this.gerarCalendario();
        
        // Event listeners
        const vendaQtd = document.getElementById('vendaQtd');
        const vendaValorUnit = document.getElementById('vendaValorUnit');
        const vendaValorPago = document.getElementById('vendaValorPago');
        const comprovanteImagem = document.getElementById('comprovanteImagem');
        
        if (vendaQtd) vendaQtd.addEventListener('input', () => this.calcularTotalVenda());
        if (vendaValorUnit) vendaValorUnit.addEventListener('input', () => this.calcularTotalVenda());
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

    // ========== SUPABASE ==========
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
    },

    // ========== MÉTODOS DO CALENDÁRIO ==========
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
        
        this.atualizarListaIngredientes();
        this.atualizarListaComprovantes();
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
    async salvarEvento() {
        if (!this.selectedDay) return;

        const eventName = document.getElementById('eventName').value;
        const responsible = document.getElementById('responsible').value;
        const notes = document.getElementById('notes').value;

        if (!this.events[this.selectedDay]) {
            this.events[this.selectedDay] = {
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
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 1500);
    },

    // ========== CUSTOS ==========
    mostrarFormIngrediente(ingredienteId = null) {
        this.ingredienteEditando = ingredienteId;
        const modalTitle = document.getElementById('ingredienteModalTitle');
        modalTitle.innerHTML = ingredienteId ? '✏️ Editar Ingrediente' : '➕ Ingrediente';
        
        this.limparFormIngrediente();
        
        if (ingredienteId && this.events[this.selectedDay].ingredientes) {
            const ingrediente = this.events[this.selectedDay].ingredientes.find(i => i.id === ingredienteId);
            if (ingrediente) {
                document.getElementById('ingredienteEditId').value = ingrediente.id;
                document.getElementById('ingredienteNome').value = ingrediente.nome;
                document.getElementById('ingredienteQtd').value = ingrediente.quantidade;
                document.getElementById('ingredienteUnidade').value = ingrediente.unidade;
                document.getElementById('ingredienteValor').value = ingrediente.valorTotal;
                document.getElementById('ingredienteComprado').checked = ingrediente.comprado || false;
                document.getElementById('ingredienteDoacao').checked = ingrediente.doacao || false;
                document.getElementById('ingredienteComprovanteId').value = ingrediente.comprovanteId || '';
            }
        }
        
        // Atualizar lista de comprovantes no select
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
            option.textContent = `${comp.nome} (R$ ${comp.valorTotal.toFixed(2)})`;
            select.appendChild(option);
        });
        
        // Mostrar select apenas se houver comprovantes
        const container = document.getElementById('comprovanteSelectContainer');
        if (container) {
            container.style.display = comprovantes.length > 0 ? 'block' : 'none';
        }
    },

    cancelarFormIngrediente() {
        document.getElementById('formIngrediente').classList.add('hidden');
        this.ingredienteEditando = null;
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
        
        // Limpar preview da imagem
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

        if (!doacao && valorTotal <= 0) {
            alert('Digite o valor total!');
            return;
        }

        if (!this.events[this.selectedDay].ingredientes) {
            this.events[this.selectedDay].ingredientes = [];
        }

        const ingrediente = {
            id,
            nome,
            quantidade,
            unidade,
            valorTotal,
            comprado,
            doacao,
            comprovanteId
        };

        if (this.ingredienteEditando) {
            // Editar existente
            const index = this.events[this.selectedDay].ingredientes.findIndex(i => i.id === this.ingredienteEditando);
            if (index !== -1) {
                this.events[this.selectedDay].ingredientes[index] = ingrediente;
            }
        } else {
            // Adicionar novo
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
        let html = '';

        ingredientes.sort((a, b) => a.nome.localeCompare(b.nome));

        ingredientes.forEach((item) => {
            const compradoClass = item.comprado ? 'comprado' : '';
            const compradoText = item.comprado ? '✅' : '⏳';
            
            html += `
                <div class="item-card ${compradoClass}" style="${item.comprado ? 'opacity: 0.7;' : ''}">
                    <div class="item-info">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span class="item-name">${item.nome}</span>
                            ${item.doacao ? '<span class="item-badge">🎁</span>' : ''}
                            ${item.comprado ? '<span class="item-badge" style="background: var(--success);">✓ Comprado</span>' : ''}
                        </div>
                        <span class="item-details">${item.quantidade} ${item.unidade} • R$ ${item.valorTotal.toFixed(2)}</span>
                        ${item.comprovanteId ? '<span class="item-details" style="color: var(--primary);">📎 Com comprovante</span>' : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button class="btn-icon" style="background: var(--success);" onclick="app.toggleCompradoIngrediente('${item.id}')" title="Marcar como comprado">
                            ${compradoText}
                        </button>
                        <button class="btn-icon" style="background: var(--primary);" onclick="app.mostrarFormIngrediente('${item.id}')" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-icon" style="background: var(--danger);" onclick="app.removerIngrediente('${item.id}')" title="Remover">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });

        document.getElementById('ingredientesList').innerHTML = html || '<div style="text-align: center; padding: 20px; color: var(--text-light);">Nenhum ingrediente</div>';
    },

    async toggleCompradoIngrediente(id) {
        const ingrediente = this.events[this.selectedDay].ingredientes.find(i => i.id == id);
        if (ingrediente) {
            ingrediente.comprado = !ingrediente.comprado;
            this.atualizarListaIngredientes();
            await this.salvarDados();
        }
    },

    async removerIngrediente(id) {
        if (confirm('Remover este ingrediente?')) {
            this.events[this.selectedDay].ingredientes = this.events[this.selectedDay].ingredientes.filter(i => i.id != id);
            this.atualizarListaIngredientes();
            this.atualizarListaComprovantes();
            this.atualizarResumoEvento();
            await this.salvarDados();
        }
    },

    // ========== COMPROVANTES ==========
    mostrarFormComprovante(comprovanteId = null) {
        this.comprovanteEditando = comprovanteId;
        this.limparFormComprovante();
        
        if (comprovanteId && this.events[this.selectedDay].comprovantes) {
            const comprovante = this.events[this.selectedDay].comprovantes.find(c => c.id === comprovanteId);
            if (comprovante) {
                document.getElementById('comprovanteEditId').value = comprovante.id;
                document.getElementById('comprovanteNome').value = comprovante.nome;
                document.getElementById('comprovanteData').value = comprovante.data || '';
                document.getElementById('comprovanteValor').value = comprovante.valorTotal || 0;
                
                if (comprovante.imagem) {
                    const preview = document.getElementById('previewImage');
                    preview.src = comprovante.imagem;
                    preview.style.display = 'block';
                }
            }
        }
        
        // Atualizar lista de itens vinculados
        this.atualizarListaItensComprovante();
        
        document.getElementById('formComprovante').classList.remove('hidden');
    },

    cancelarFormComprovante() {
        document.getElementById('formComprovante').classList.add('hidden');
        this.comprovanteEditando = null;
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

    atualizarListaItensComprovante() {
        const container = document.getElementById('comprovanteItensList');
        if (!container) return;
        
        const comprovanteId = this.comprovanteEditando;
        const ingredientes = this.events[this.selectedDay]?.ingredientes || [];
        
        let html = '';
        ingredientes.forEach(item => {
            const vinculado = item.comprovanteId == comprovanteId;
            html += `
                <div style="display: flex; align-items: center; gap: 8px; padding: 4px; background: ${vinculado ? 'var(--primary-light)' : 'transparent'}; border-radius: 4px; margin-bottom: 4px;">
                    <span style="flex: 1;">${item.nome} - R$ ${item.valorTotal.toFixed(2)}</span>
                    ${vinculado ? '<span style="color: var(--success);">✓</span>' : ''}
                </div>
            `;
        });
        
        container.innerHTML = html || '<p>Nenhum item cadastrado</p>';
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
                this.events[this.selectedDay].comprovantes.find(c => c.id === this.comprovanteEditando)?.imagem : null)
        };

        if (this.comprovanteEditando) {
            const index = this.events[this.selectedDay].comprovantes.findIndex(c => c.id === this.comprovanteEditando);
            if (index !== -1) {
                this.events[this.selectedDay].comprovantes[index] = comprovante;
            }
        } else {
            this.events[this.selectedDay].comprovantes.push(comprovante);
        }

        this.cancelarFormComprovante();
        this.atualizarListaComprovantes();
        this.atualizarSelectComprovantes();
        await this.salvarDados();
    },

    atualizarListaComprovantes() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const comprovantes = this.events[this.selectedDay].comprovantes || [];
        let html = '';

        comprovantes.forEach((comp, index) => {
            // Contar itens vinculados
            const itensVinculados = (this.events[this.selectedDay].ingredientes || [])
                .filter(i => i.comprovanteId == comp.id).length;
            
            html += `
                <div class="item-card" style="border-left-color: var(--success);">
                    <div class="item-info">
                        <span class="item-name">📎 ${comp.nome}</span>
                        <span class="item-details">${comp.data || 'Sem data'} • R$ ${comp.valorTotal.toFixed(2)}</span>
                        <span class="item-details">${itensVinculados} itens vinculados</span>
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
        const comprovante = this.events[this.selectedDay].comprovantes.find(c => c.id == id);
        if (comprovante?.imagem) {
            // Abrir modal com imagem
            const win = window.open();
            win.document.write(`
                <html>
                    <head><title>${comprovante.nome}</title></head>
                    <body style="margin:0; display:flex; align-items:center; justify-content:center; background:#f0f0f0;">
                        <img src="${comprovante.imagem}" style="max-width:100%; max-height:100vh; object-fit:contain;">
                    </body>
                </html>
            `);
        } else {
            alert('Este comprovante não possui imagem!');
        }
    },

    async removerComprovante(id) {
        if (confirm('Remover este comprovante? Os itens vinculados serão desvinculados.')) {
            // Desvincular itens
            if (this.events[this.selectedDay].ingredientes) {
                this.events[this.selectedDay].ingredientes.forEach(item => {
                    if (item.comprovanteId == id) {
                        item.comprovanteId = null;
                    }
                });
            }
            
            // Remover comprovante
            this.events[this.selectedDay].comprovantes = this.events[this.selectedDay].comprovantes.filter(c => c.id != id);
            
            this.atualizarListaIngredientes();
            this.atualizarListaComprovantes();
            this.atualizarSelectComprovantes();
            await this.salvarDados();
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

    async salvarVenda() {
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
            id: this.vendaEditando || Date.now(),
            cliente,
            produto,
            quantidade,
            valorUnit,
            valorPago,
            formaPagamento,
            entrega,
            observacoes
        };

        if (this.vendaEditando) {
            const index = this.events[this.selectedDay].vendas.findIndex(v => v.id === this.vendaEditando);
            if (index !== -1) {
                this.events[this.selectedDay].vendas[index] = venda;
            }
        } else {
            this.events[this.selectedDay].vendas.push(venda);
        }

        this.cancelarFormVenda();
        this.atualizarListaVendas();
        this.atualizarResumoEvento();
        await this.salvarDados();
    },

    atualizarListaVendas() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const vendas = this.events[this.selectedDay].vendas || [];
        let html = '';

        vendas.sort((a, b) => a.cliente.localeCompare(b.cliente));

        vendas.forEach((venda) => {
            const valorTotal = venda.quantidade * venda.valorUnit;
            const pendente = valorTotal - (venda.valorPago || 0);

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
                            `<button class="btn btn-success btn-sm" style="flex: 1;" onclick="app.abrirPagamento('${venda.id}')">💰 Pagar</button>` : ''}
                        <button class="btn btn-outline btn-sm" style="flex: 1;" onclick="app.editarVenda('${venda.id}')">✏️</button>
                        <button class="btn btn-danger btn-sm" style="width: 40px;" onclick="app.removerVenda('${venda.id}')">🗑️</button>
                    </div>
                </div>
            `;
        });

        document.getElementById('vendasList').innerHTML = html || '<div style="text-align: center; padding: 30px; color: var(--text-light);">Nenhuma venda</div>';
    },

    async abrirPagamento(id) {
        this.pagamentoVendaId = id;
        const venda = this.events[this.selectedDay].vendas.find(v => v.id == id);
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

        const venda = this.events[this.selectedDay].vendas.find(v => v.id == this.pagamentoVendaId);
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
        await this.salvarDados();
    },

    editarVenda(id) {
        this.vendaEditando = id;
        const venda = this.events[this.selectedDay].vendas.find(v => v.id == id);
        
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

    async removerVenda(id) {
        if (confirm('Remover esta venda?')) {
            this.events[this.selectedDay].vendas = this.events[this.selectedDay].vendas.filter(v => v.id != id);
            this.atualizarListaVendas();
            this.atualizarResumoEvento();
            await this.salvarDados();
        }
    },

    // ========== RELATÓRIOS ==========
    atualizarRelatorioEvento() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const evento = this.events[this.selectedDay];
        const ingredientes = evento.ingredientes || [];
        const vendas = evento.vendas || [];
        const comprovantes = evento.comprovantes || [];
        
        const totalCustos = ingredientes.reduce((acc, item) => acc + (item.doacao ? 0 : item.valorTotal), 0);
        const totalComprado = ingredientes
            .filter(item => item.comprado && !item.doacao)
            .reduce((acc, item) => acc + item.valorTotal, 0);
        const itensComprados = ingredientes.filter(item => item.comprado).length;
        
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
        document.getElementById('relItensComprados').innerHTML = itensComprados;
        document.getElementById('relTotalComprovantes').innerHTML = comprovantes.length;
        document.getElementById('relTotalComprado').innerHTML = `R$ ${totalComprado.toFixed(2)}`;
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