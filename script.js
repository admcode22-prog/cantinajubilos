// Configuração do Supabase
const SUPABASE_URL = 'https://uqfznchyfcidyqlqauua.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_covwt0qpmNmdoRy8oGVdng_kgSdCGBT';

const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Prefer': 'return=representation'
};

const App = {
    // Dados locais
    eventos: {}, // { dataKey: { id, nome, responsavel, observacoes } }
    producao: [],
    ingredientes: [],
    comprovantes: [],
    vendas: [],
    
    // Estado da aplicação
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    selectedDay: null,
    selectedEventoId: null,
    
    // Controles de edição
    vendaEditando: null,
    pagamentoVendaId: null,
    ingredienteEditando: null,
    producaoEditando: null,
    comprovanteEditando: null,
    
    carregando: false,
    ingredientesSelecionados: [],

    async init() {
        this.mostrarLoading();
        await this.carregarTodosDados();
        this.atualizarHeader();
        this.gerarCalendario();
        
        // Event listeners
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

    // ========== SUPABASE - CARREGAR DADOS ==========
    async carregarTodosDados() {
        try {
            console.log('Carregando dados do Supabase...');
            
            // Carregar eventos
            const eventosRes = await fetch(`${SUPABASE_URL}/rest/v1/eventos`, {
                method: 'GET',
                headers: headers
            });
            const eventosData = await eventosRes.json();
            
            this.eventos = {};
            eventosData.forEach(e => {
                this.eventos[e.data] = {
                    id: e.id,
                    nome: e.nome || '',
                    responsavel: e.responsavel || '',
                    observacoes: e.observacoes || ''
                };
            });
            
            // Carregar produção
            const producaoRes = await fetch(`${SUPABASE_URL}/rest/v1/producao`, {
                method: 'GET',
                headers: headers
            });
            this.producao = await producaoRes.json();
            
            // Carregar ingredientes
            const ingredientesRes = await fetch(`${SUPABASE_URL}/rest/v1/ingredientes`, {
                method: 'GET',
                headers: headers
            });
            this.ingredientes = await ingredientesRes.json();
            
            // Carregar comprovantes
            const comprovantesRes = await fetch(`${SUPABASE_URL}/rest/v1/comprovantes`, {
                method: 'GET',
                headers: headers
            });
            this.comprovantes = await comprovantesRes.json();
            
            // Carregar vendas
            const vendasRes = await fetch(`${SUPABASE_URL}/rest/v1/vendas`, {
                method: 'GET',
                headers: headers
            });
            this.vendas = await vendasRes.json();
            
            console.log('Dados carregados:', {
                eventos: this.eventos,
                producao: this.producao,
                ingredientes: this.ingredientes,
                comprovantes: this.comprovantes,
                vendas: this.vendas
            });
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            alert('Erro ao carregar dados do servidor.');
        }
    },

    // ========== SUPABASE - SALVAR ==========
    async salvarEvento(dataKey, nome, responsavel, observacoes) {
        try {
            const eventoExistente = this.eventos[dataKey];
            
            if (eventoExistente) {
                // Atualizar
                const response = await fetch(`${SUPABASE_URL}/rest/v1/eventos?id=eq.${eventoExistente.id}`, {
                    method: 'PATCH',
                    headers: headers,
                    body: JSON.stringify({
                        nome: nome,
                        responsavel: responsavel,
                        observacoes: observacoes,
                        updated_at: new Date().toISOString()
                    })
                });
                
                if (!response.ok) throw new Error('Erro ao atualizar evento');
                
                this.eventos[dataKey] = {
                    ...eventoExistente,
                    nome,
                    responsavel,
                    observacoes
                };
                
                return eventoExistente.id;
                
            } else {
                // Criar novo
                const response = await fetch(`${SUPABASE_URL}/rest/v1/eventos`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        data: dataKey,
                        nome: nome,
                        responsavel: responsavel,
                        observacoes: observacoes,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error('Erro ao criar evento');
                
                const novoEvento = data[0];
                this.eventos[dataKey] = {
                    id: novoEvento.id,
                    nome,
                    responsavel,
                    observacoes
                };
                
                return novoEvento.id;
            }
            
        } catch (error) {
            console.error('Erro ao salvar evento:', error);
            throw error;
        }
    },

    async salvarProducao(item) {
        try {
            let response;
            
            if (item.id) {
                // Atualizar
                response = await fetch(`${SUPABASE_URL}/rest/v1/producao?id=eq.${item.id}`, {
                    method: 'PATCH',
                    headers: headers,
                    body: JSON.stringify(item)
                });
            } else {
                // Criar
                response = await fetch(`${SUPABASE_URL}/rest/v1/producao`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(item)
                });
            }
            
            if (!response.ok) {
                const erro = await response.text();
                throw new Error(`Erro: ${erro}`);
            }
            
            const data = await response.json();
            
            if (!item.id) {
                // Se foi criação, adicionar ao array local
                this.producao.push(data[0]);
                return data[0];
            } else {
                // Se foi atualização, atualizar no array local
                const index = this.producao.findIndex(p => p.id === item.id);
                if (index !== -1) this.producao[index] = item;
            }
            
        } catch (error) {
            console.error('Erro ao salvar produção:', error);
            throw error;
        }
    },

    async salvarIngrediente(item) {
        try {
            console.log('Salvando ingrediente:', item);
            
            let response;
            
            if (item.id) {
                // Atualizar
                response = await fetch(`${SUPABASE_URL}/rest/v1/ingredientes?id=eq.${item.id}`, {
                    method: 'PATCH',
                    headers: headers,
                    body: JSON.stringify(item)
                });
            } else {
                // Criar
                response = await fetch(`${SUPABASE_URL}/rest/v1/ingredientes`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(item)
                });
            }
            
            if (!response.ok) {
                const erro = await response.text();
                throw new Error(`Erro: ${erro}`);
            }
            
            const data = await response.json();
            
            if (!item.id) {
                // Se foi criação, adicionar ao array local
                this.ingredientes.push(data[0]);
                return data[0];
            } else {
                // Se foi atualização, atualizar no array local
                const index = this.ingredientes.findIndex(i => i.id === item.id);
                if (index !== -1) this.ingredientes[index] = item;
            }
            
            console.log('Ingrediente salvo com sucesso');
            
        } catch (error) {
            console.error('Erro ao salvar ingrediente:', error);
            throw error;
        }
    },

    async salvarComprovante(item) {
        try {
            let response;
            
            if (item.id) {
                response = await fetch(`${SUPABASE_URL}/rest/v1/comprovantes?id=eq.${item.id}`, {
                    method: 'PATCH',
                    headers: headers,
                    body: JSON.stringify(item)
                });
            } else {
                response = await fetch(`${SUPABASE_URL}/rest/v1/comprovantes`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(item)
                });
            }
            
            if (!response.ok) {
                const erro = await response.text();
                throw new Error(`Erro: ${erro}`);
            }
            
            const data = await response.json();
            
            if (!item.id) {
                this.comprovantes.push(data[0]);
                return data[0];
            } else {
                const index = this.comprovantes.findIndex(c => c.id === item.id);
                if (index !== -1) this.comprovantes[index] = item;
            }
            
        } catch (error) {
            console.error('Erro ao salvar comprovante:', error);
            throw error;
        }
    },

    async salvarVenda(item) {
        try {
            let response;
            
            if (item.id) {
                response = await fetch(`${SUPABASE_URL}/rest/v1/vendas?id=eq.${item.id}`, {
                    method: 'PATCH',
                    headers: headers,
                    body: JSON.stringify(item)
                });
            } else {
                response = await fetch(`${SUPABASE_URL}/rest/v1/vendas`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(item)
                });
            }
            
            if (!response.ok) {
                const erro = await response.text();
                throw new Error(`Erro: ${erro}`);
            }
            
            const data = await response.json();
            
            if (!item.id) {
                this.vendas.push(data[0]);
                return data[0];
            } else {
                const index = this.vendas.findIndex(v => v.id === item.id);
                if (index !== -1) this.vendas[index] = item;
            }
            
        } catch (error) {
            console.error('Erro ao salvar venda:', error);
            throw error;
        }
    },

    async deletarProducao(id) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/producao?id=eq.${id}`, {
                method: 'DELETE',
                headers: headers
            });
            if (!response.ok) throw new Error('Erro ao deletar produção');
            this.producao = this.producao.filter(p => p.id !== id);
        } catch (error) {
            console.error('Erro ao deletar produção:', error);
            throw error;
        }
    },

    async deletarIngrediente(id) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/ingredientes?id=eq.${id}`, {
                method: 'DELETE',
                headers: headers
            });
            if (!response.ok) throw new Error('Erro ao deletar ingrediente');
            this.ingredientes = this.ingredientes.filter(i => i.id !== id);
        } catch (error) {
            console.error('Erro ao deletar ingrediente:', error);
            throw error;
        }
    },

    async deletarComprovante(id) {
        try {
            // Primeiro, desvincular ingredientes
            const ingredientesVinculados = this.ingredientes.filter(i => i.comprovante_id === id);
            for (const ing of ingredientesVinculados) {
                ing.comprovante_id = null;
                await this.salvarIngrediente(ing);
            }
            
            const response = await fetch(`${SUPABASE_URL}/rest/v1/comprovantes?id=eq.${id}`, {
                method: 'DELETE',
                headers: headers
            });
            if (!response.ok) throw new Error('Erro ao deletar comprovante');
            
            this.comprovantes = this.comprovantes.filter(c => c.id !== id);
        } catch (error) {
            console.error('Erro ao deletar comprovante:', error);
            throw error;
        }
    },

    async deletarVenda(id) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/vendas?id=eq.${id}`, {
                method: 'DELETE',
                headers: headers
            });
            if (!response.ok) throw new Error('Erro ao deletar venda');
            this.vendas = this.vendas.filter(v => v.id !== id);
        } catch (error) {
            console.error('Erro ao deletar venda:', error);
            throw error;
        }
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
            const temEvento = this.eventos[dataKey];
            
            html += `
                <div class="calendar-day ${temEvento ? 'has-event' : ''}" onclick="app.abrirDia('${dataKey}')">
                    <div class="day-number">${dia}</div>
                    ${temEvento ? '<div class="event-tag">' + (temEvento.nome?.substring(0, 5) || 'Evento') + '</div>' : ''}
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
        console.log('Abrindo dia:', dataKey);
        this.selectedDay = dataKey;
        
        const evento = this.eventos[dataKey];
        
        if (!evento) {
            // Criar evento automaticamente
            const novoId = await this.salvarEvento(dataKey, '', '', '');
            this.selectedEventoId = novoId;
        } else {
            this.selectedEventoId = evento.id;
        }

        const [ano, mes, dia] = dataKey.split('-');
        document.getElementById('selectedDate').innerHTML = `📅 ${dia}/${mes}/${ano}`;
        
        this.carregarDadosEvento();
        
        document.getElementById('calendarSection').classList.add('hidden');
        document.getElementById('managementSection').classList.remove('hidden');
        this.mudarAba('evento');
    },

    carregarDadosEvento() {
        if (!this.selectedEventoId) return;

        const evento = this.eventos[this.selectedDay];
        
        document.getElementById('selectedEventName').innerHTML = evento?.nome || 'Novo Evento';
        document.getElementById('selectedResponsible').innerHTML = `👤 ${evento?.responsavel || 'Clique para editar'}`;
        
        document.getElementById('eventName').value = evento?.nome || '';
        document.getElementById('responsible').value = evento?.responsavel || '';
        document.getElementById('notes').value = evento?.observacoes || '';
        
        this.atualizarListaProducao();
        this.atualizarListaIngredientes();
        this.atualizarListaComprovantes();
        this.atualizarListaVendas();
        this.atualizarResumoEvento();
        this.atualizarSelectProdutos();
    },

    atualizarResumoEvento() {
        if (!this.selectedEventoId) return;

        const ingredientes = this.ingredientes.filter(i => i.evento_id === this.selectedEventoId);
        const vendas = this.vendas.filter(v => v.evento_id === this.selectedEventoId);
        
        const totalCustos = ingredientes.reduce((acc, item) => acc + (item.doacao ? 0 : (item.valor_total || 0)), 0);
        const totalVendas = vendas.reduce((acc, venda) => acc + (venda.quantidade * venda.valor_unit), 0);
        const totalRecebido = vendas.reduce((acc, venda) => acc + (venda.valor_pago || 0), 0);
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
            
            if (this.eventos[this.selectedDay]) {
                const evento = this.eventos[this.selectedDay];
                document.getElementById('eventName').value = evento.nome || '';
                document.getElementById('responsible').value = evento.responsavel || '';
                document.getElementById('notes').value = evento.observacoes || '';
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

        const nome = document.getElementById('eventName').value;
        const responsavel = document.getElementById('responsible').value;
        const observacoes = document.getElementById('notes').value;

        const eventoId = await this.salvarEvento(this.selectedDay, nome, responsavel, observacoes);
        this.selectedEventoId = eventoId;

        document.getElementById('selectedEventName').innerHTML = nome || 'Novo Evento';
        document.getElementById('selectedResponsible').innerHTML = `👤 ${responsavel || 'Clique para editar'}`;

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
            const item = this.producao.find(p => p.id === producaoId);
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
        if (!this.selectedEventoId) return;

        const id = document.getElementById('producaoEditId').value ? parseInt(document.getElementById('producaoEditId').value) : null;
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

        const item = {
            id: id,
            evento_id: this.selectedEventoId,
            nome: nome,
            quantidade: quantidade,
            valor: valor,
            vendido: 0
        };

        if (id) {
            const existing = this.producao.find(p => p.id === id);
            if (existing) {
                item.vendido = existing.vendido || 0;
            }
        }

        await this.salvarProducao(item);
        this.cancelarFormProducao();
        this.atualizarListaProducao();
        this.atualizarSelectProdutos();
    },

    atualizarListaProducao() {
        if (!this.selectedEventoId) return;

        const producao = this.producao.filter(p => p.evento_id === this.selectedEventoId);
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
                        <button class="btn-icon" style="background: var(--primary);" onclick="app.mostrarFormProducao(${item.id})" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-icon" style="background: var(--danger);" onclick="app.removerProducao(${item.id})" title="Remover">
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
            await this.deletarProducao(id);
            this.atualizarListaProducao();
            this.atualizarSelectProdutos();
        }
    },

    atualizarSelectProdutos() {
        const select = document.getElementById('vendaProdutoId');
        if (!select) return;

        const producao = this.producao.filter(p => p.evento_id === this.selectedEventoId);
        
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
        const produtoId = select.value ? parseInt(select.value) : null;
        
        if (!produtoId) {
            document.getElementById('vendaValorUnit').value = '';
            document.getElementById('vendaDisponivel').value = '';
            return;
        }

        const produto = this.producao.find(p => p.id === produtoId);
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
            
            const id = typeof ingredienteId === 'string' ? parseInt(ingredienteId) : ingredienteId;
            const ingrediente = this.ingredientes.find(i => i.id === id);
            
            if (ingrediente) {
                console.log('Editando ingrediente:', ingrediente);
                document.getElementById('ingredienteEditId').value = ingrediente.id || '';
                document.getElementById('ingredienteNome').value = ingrediente.nome || '';
                document.getElementById('ingredienteQtd').value = ingrediente.quantidade || '';
                document.getElementById('ingredienteUnidade').value = ingrediente.unidade || 'un';
                document.getElementById('ingredienteValor').value = ingrediente.valor_total || '';
                document.getElementById('ingredienteComprado').checked = ingrediente.comprado || false;
                document.getElementById('ingredienteDoacao').checked = ingrediente.doacao || false;
                
                if (ingrediente.comprovante_id) {
                    document.getElementById('ingredienteComprovanteId').value = ingrediente.comprovante_id;
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
        
        const comprovantes = this.comprovantes.filter(c => c.evento_id === this.selectedEventoId);
        comprovantes.forEach(comp => {
            const option = document.createElement('option');
            option.value = comp.id;
            option.textContent = `${comp.nome} (R$ ${(comp.valor_total || 0).toFixed(2)})`;
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
    },

    async salvarIngrediente() {
        if (!this.selectedEventoId) return;

        const id = document.getElementById('ingredienteEditId').value ? parseInt(document.getElementById('ingredienteEditId').value) : null;
        const nome = document.getElementById('ingredienteNome').value;
        const quantidade = parseFloat(document.getElementById('ingredienteQtd').value) || 0;
        const unidade = document.getElementById('ingredienteUnidade').value;
        const valorTotal = parseFloat(document.getElementById('ingredienteValor').value) || 0;
        const comprado = document.getElementById('ingredienteComprado').checked;
        const doacao = document.getElementById('ingredienteDoacao').checked;
        const comprovanteId = document.getElementById('ingredienteComprovanteId').value ? parseInt(document.getElementById('ingredienteComprovanteId').value) : null;

        if (!nome) {
            alert('Digite o nome do ingrediente!');
            return;
        }

        if (quantidade <= 0) {
            alert('Digite a quantidade!');
            return;
        }

        const ingrediente = {
            id: id,
            evento_id: this.selectedEventoId,
            nome: nome,
            quantidade: quantidade,
            unidade: unidade,
            valor_total: valorTotal,
            comprado: comprado,
            doacao: doacao,
            comprovante_id: comprovanteId
        };

        console.log('Salvando ingrediente:', ingrediente);

        await this.salvarIngrediente(ingrediente);
        this.cancelarFormIngrediente();
        this.atualizarListaIngredientes();
        this.atualizarListaComprovantes();
        this.atualizarResumoEvento();
    },

    atualizarListaIngredientes() {
        if (!this.selectedEventoId) return;

        const ingredientes = this.ingredientes.filter(i => i.evento_id === this.selectedEventoId);
        const comprovantes = this.comprovantes.filter(c => c.evento_id === this.selectedEventoId);
        let html = '';

        ingredientes.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

        ingredientes.forEach((item) => {
            const compradoClass = item.comprado ? 'comprado' : '';
            const compradoText = item.comprado ? '✅' : '⏳';
            
            const valorDisplay = item.valor_total > 0 ? `R$ ${item.valor_total.toFixed(2)}` : '💰 A definir';
            
            const temComprovante = item.comprovante_id ? true : false;
            const comprovante = temComprovante ? comprovantes.find(c => c.id === item.comprovante_id) : null;
            
            html += `
                <div class="item-card ${compradoClass}" style="${item.comprado ? 'opacity: 0.8;' : ''}">
                    <div class="item-info">
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span class="item-name">${item.nome || 'Sem nome'}</span>
                            ${item.doacao ? '<span class="item-badge">🎁 Doação</span>' : ''}
                            ${item.comprado ? '<span class="item-badge" style="background: var(--success);">✓ Comprado</span>' : ''}
                            ${item.valor_total === 0 && !item.doacao ? '<span class="item-badge" style="background: var(--warning);">⏳ Pendente</span>' : ''}
                            ${temComprovante ? '<span class="item-badge" style="background: var(--primary);">📎 Comprovante</span>' : ''}
                        </div>
                        <span class="item-details">${item.quantidade || 0} ${item.unidade || 'un'} • ${valorDisplay}</span>
                        ${temComprovante ? `
                            <div style="display: flex; align-items: center; gap: 4px; margin-top: 4px;">
                                <span class="item-details" style="color: var(--primary);">📎 ${comprovante?.nome || 'Comprovante'}</span>
                                <button class="btn-icon" style="background: var(--primary); width: 24px; height: 24px; font-size: 0.8rem;" onclick="app.verComprovanteDoIngrediente(${item.comprovante_id})" title="Ver comprovante">
                                    👁️
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button class="btn-icon" style="background: var(--success);" onclick="app.toggleCompradoIngrediente(${item.id})" title="Marcar como comprado">
                            ${compradoText}
                        </button>
                        <button class="btn-icon" style="background: var(--primary);" onclick="app.mostrarFormIngrediente(${item.id})" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-icon" style="background: var(--danger);" onclick="app.removerIngrediente(${item.id})" title="Remover">
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
        
        const comprovante = this.comprovantes.find(c => c.id === comprovanteId);
        this.mostrarComprovanteEmJanela(comprovante);
    },

    async toggleCompradoIngrediente(id) {
        const ingrediente = this.ingredientes.find(i => i.id === id);
        if (ingrediente) {
            ingrediente.comprado = !ingrediente.comprado;
            await this.salvarIngrediente(ingrediente);
            this.atualizarListaIngredientes();
        }
    },

    async removerIngrediente(id) {
        if (confirm('Remover este ingrediente?')) {
            await this.deletarIngrediente(id);
            this.atualizarListaIngredientes();
            this.atualizarListaComprovantes();
            this.atualizarResumoEvento();
        }
    },

    // ========== COMPROVANTES ==========
    mostrarFormComprovante(comprovanteId = null) {
        this.comprovanteEditando = comprovanteId;
        this.ingredientesSelecionados = [];
        
        this.limparFormComprovante();
        
        if (comprovanteId) {
            const id = typeof comprovanteId === 'string' ? parseInt(comprovanteId) : comprovanteId;
            const comprovante = this.comprovantes.find(c => c.id === id);
            if (comprovante) {
                document.getElementById('comprovanteEditId').value = comprovante.id;
                document.getElementById('comprovanteNome').value = comprovante.nome || '';
                document.getElementById('comprovanteData').value = comprovante.data || '';
                document.getElementById('comprovanteValor').value = comprovante.valor_total || 0;
                
                if (comprovante.imagem) {
                    const preview = document.getElementById('previewImage');
                    preview.src = comprovante.imagem;
                    preview.style.display = 'block';
                }
                
                const ingredientes = this.ingredientes.filter(i => i.evento_id === this.selectedEventoId);
                this.ingredientesSelecionados = ingredientes
                    .filter(i => i.comprovante_id === comprovante.id)
                    .map(i => i.id);
            }
        }
        
        this.atualizarListaIngredientesParaComprovante();
        document.getElementById('formComprovante').classList.remove('hidden');
    },

    atualizarListaIngredientesParaComprovante() {
        const container = document.getElementById('comprovanteItensList');
        if (!container) return;
        
        const ingredientes = this.ingredientes.filter(i => i.evento_id === this.selectedEventoId);
        
        if (ingredientes.length === 0) {
            container.innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 10px;">Nenhum ingrediente cadastrado</p>';
            return;
        }
        
        let html = '';
        
        ingredientes.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        
        ingredientes.forEach(item => {
            const estaSelecionado = this.ingredientesSelecionados.includes(item.id);
            const valorDisplay = item.valor_total > 0 ? `R$ ${item.valor_total.toFixed(2)}` : '💰 A definir';
            
            html += `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px; border-bottom: 1px solid var(--border); background: ${estaSelecionado ? 'rgba(249, 115, 22, 0.1)' : 'transparent'};">
                    <input type="checkbox" 
                           id="ingrediente_${item.id}" 
                           value="${item.id}"
                           ${estaSelecionado ? 'checked' : ''}
                           onchange="app.toggleIngredienteComprovante(${item.id})"
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
        const id = typeof ingredienteId === 'string' ? parseInt(ingredienteId) : ingredienteId;
        const index = this.ingredientesSelecionados.indexOf(id);
        if (index === -1) {
            this.ingredientesSelecionados.push(id);
        } else {
            this.ingredientesSelecionados.splice(index, 1);
        }
        
        const checkbox = document.getElementById(`ingrediente_${id}`);
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
        if (!this.selectedEventoId) return;

        const id = document.getElementById('comprovanteEditId').value ? parseInt(document.getElementById('comprovanteEditId').value) : null;
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

        const comprovante = {
            id: id,
            evento_id: this.selectedEventoId,
            nome: nome,
            data: data || null,
            valor_total: valorTotal,
            imagem: imagem || (id ? this.comprovantes.find(c => c.id === id)?.imagem : null)
        };

        const comprovanteSalvo = await this.salvarComprovante(comprovante);
        const comprovanteId = comprovanteSalvo ? comprovanteSalvo.id : id;

        // Atualizar ingredientes com o ID do comprovante
        const ingredientes = this.ingredientes.filter(i => i.evento_id === this.selectedEventoId);
        
        for (const ing of ingredientes) {
            const novoComprovanteId = this.ingredientesSelecionados.includes(ing.id) ? comprovanteId : null;
            if (ing.comprovante_id !== novoComprovanteId) {
                ing.comprovante_id = novoComprovanteId;
                await this.salvarIngrediente(ing);
            }
        }

        this.cancelarFormComprovante();
        this.atualizarListaIngredientes();
        this.atualizarListaComprovantes();
        this.atualizarSelectComprovantes();
        this.atualizarResumoEvento();
    },

    atualizarListaComprovantes() {
        if (!this.selectedEventoId) return;

        const comprovantes = this.comprovantes.filter(c => c.evento_id === this.selectedEventoId);
        const ingredientes = this.ingredientes.filter(i => i.evento_id === this.selectedEventoId);
        let html = '';

        comprovantes.forEach((comp) => {
            const itensVinculados = ingredientes.filter(i => i.comprovante_id === comp.id);
            
            const totalItens = itensVinculados.length;
            const totalValorItens = itensVinculados.reduce((acc, item) => acc + (item.valor_total || 0), 0);
            
            const itensList = itensVinculados.map(item => 
                `<div style="font-size: 0.7rem; color: var(--text-light); margin-left: 10px;">• ${item.nome} - R$ ${(item.valor_total || 0).toFixed(2)}</div>`
            ).join('');
            
            html += `
                <div class="item-card" style="border-left-color: var(--success);">
                    <div class="item-info">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span class="item-name">📎 ${comp.nome}</span>
                            <span class="item-badge" style="background: var(--primary);">${totalItens} itens</span>
                        </div>
                        <span class="item-details">${comp.data || 'Sem data'} • R$ ${(comp.valor_total || 0).toFixed(2)}</span>
                        <span class="item-details">Valor nos itens: R$ ${totalValorItens.toFixed(2)}</span>
                        
                        ${totalItens > 0 ? `
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border);">
                                <div style="font-weight: 600; font-size: 0.8rem; margin-bottom: 4px;">Itens neste comprovante:</div>
                                ${itensList}
                            </div>
                        ` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button class="btn-icon" style="background: var(--primary);" onclick="app.verComprovante(${comp.id})" title="Ver">
                            👁️
                        </button>
                        <button class="btn-icon" style="background: var(--warning);" onclick="app.mostrarFormComprovante(${comp.id})" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-icon" style="background: var(--danger);" onclick="app.removerComprovante(${comp.id})" title="Remover">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });

        document.getElementById('comprovantesList').innerHTML = html || '<div style="text-align: center; padding: 20px; color: var(--text-light);">Nenhum comprovante</div>';
    },

    verComprovante(id) {
        const comprovante = this.comprovantes.find(c => c.id === id);
        this.mostrarComprovanteEmJanela(comprovante);
    },

    mostrarComprovanteEmJanela(comprovante) {
        if (!comprovante?.imagem) {
            alert('Este comprovante não possui imagem!');
            return;
        }
        
        const ingredientes = this.ingredientes.filter(i => i.evento_id === this.selectedEventoId);
        const itensVinculados = ingredientes.filter(i => i.comprovante_id === comprovante.id);
        
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
                            <p>Data: ${comprovante.data || 'Não informada'} • Valor Total: R$ ${(comprovante.valor_total || 0).toFixed(2)}</p>
                        </div>
                        
                        ${itensVinculados.length > 0 ? `
                            <div class="itens-list">
                                <h3>🛒 Itens neste comprovante:</h3>
                                <ul>
                                    ${itensVinculados.map(item => 
                                        `<li>${item.nome} - ${item.quantidade} ${item.unidade} - R$ ${(item.valor_total || 0).toFixed(2)}</li>`
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
            await this.deletarComprovante(id);
            this.atualizarListaIngredientes();
            this.atualizarListaComprovantes();
            this.atualizarSelectComprovantes();
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
        if (!this.selectedEventoId) return;

        const cliente = document.getElementById('vendaCliente').value;
        const produtoId = document.getElementById('vendaProdutoId').value ? parseInt(document.getElementById('vendaProdutoId').value) : null;
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

        const produto = this.producao.find(p => p.id === produtoId);
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

        const venda = {
            id: this.vendaEditando,
            evento_id: this.selectedEventoId,
            cliente: cliente,
            produto_id: produtoId,
            produto_nome: produto.nome,
            quantidade: quantidade,
            valor_unit: valorUnit,
            valor_pago: valorPago,
            forma_pagamento: formaPagamento,
            entrega: entrega,
            observacoes: observacoes,
            data_venda: new Date().toISOString()
        };

        if (this.vendaEditando) {
            const vendaAntiga = this.vendas.find(v => v.id === this.vendaEditando);
            if (vendaAntiga) {
                produto.vendido = (produto.vendido || 0) - vendaAntiga.quantidade;
            }
        }

        produto.vendido = (produto.vendido || 0) + quantidade;
        await this.salvarProducao(produto);

        await this.salvarVenda(venda);

        this.cancelarFormVenda();
        this.atualizarListaProducao();
        this.atualizarListaVendas();
        this.atualizarResumoEvento();
        this.atualizarSelectProdutos();
        this.atualizarTotaisGerais();
    },

    atualizarListaVendas() {
        if (!this.selectedEventoId) return;

        const vendas = this.vendas.filter(v => v.evento_id === this.selectedEventoId);
        let html = '';

        vendas.sort((a, b) => new Date(b.data_venda) - new Date(a.data_venda));

        vendas.forEach((venda) => {
            const valorTotal = venda.quantidade * venda.valor_unit;
            const pendente = valorTotal - (venda.valor_pago || 0);

            html += `
                <div class="venda-card" data-id="${venda.id}">
                    <div class="venda-header">
                        <span class="cliente-nome">${venda.cliente}</span>
                        <span class="entrega-badge ${venda.entrega}">${venda.entrega === 'sim' ? '✅ Entregue' : '⏳ Pendente'}</span>
                    </div>
                    
                    <div class="venda-produto">
                        ${venda.produto_nome} • ${venda.quantidade}x R$ ${venda.valor_unit.toFixed(2)}
                    </div>
                    
                    <div class="venda-pagamento">
                        <div>Total:<br><strong>R$ ${valorTotal.toFixed(2)}</strong></div>
                        <div>Pago:<br><strong>R$ ${(venda.valor_pago || 0).toFixed(2)}</strong></div>
                        <div>Falta:<br><strong class="${pendente > 0 ? 'warning' : 'success'}">R$ ${pendente.toFixed(2)}</strong></div>
                        <div>Forma:<br><strong>${venda.forma_pagamento?.replace('_', ' ') || ''}</strong></div>
                    </div>
                    
                    <div class="venda-actions">
                        ${pendente > 0 ? 
                            `<button class="btn btn-success btn-sm" style="flex: 1;" onclick="app.abrirPagamento(${venda.id})">💰 Pagar</button>` : ''}
                        <button class="btn btn-outline btn-sm" style="flex: 1;" onclick="app.editarVenda(${venda.id})">✏️</button>
                        <button class="btn btn-danger btn-sm" style="width: 40px;" onclick="app.removerVenda(${venda.id})">🗑️</button>
                    </div>
                </div>
            `;
        });

        document.getElementById('vendasList').innerHTML = html || '<div style="text-align: center; padding: 30px; color: var(--text-light);">Nenhuma venda</div>';
    },

    abrirPagamento(id) {
        this.pagamentoVendaId = id;
        const venda = this.vendas.find(v => v.id === id);
        if (!venda) return;
        
        const total = venda.quantidade * venda.valor_unit;
        const pendente = total - (venda.valor_pago || 0);
        
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
        if (this.pagamentoVendaId === null || !this.selectedEventoId) return;

        const valor = parseFloat(document.getElementById('pagamentoValor').value) || 0;
        const forma = document.getElementById('pagamentoForma').value;

        if (valor <= 0) {
            alert('Digite um valor válido!');
            return;
        }

        const venda = this.vendas.find(v => v.id === this.pagamentoVendaId);
        if (!venda) return;
        
        const total = venda.quantidade * venda.valor_unit;
        const novoPago = (venda.valor_pago || 0) + valor;

        if (novoPago > total) {
            alert('Valor maior que o total!');
            return;
        }

        venda.valor_pago = novoPago;
        venda.forma_pagamento = forma;

        await this.salvarVenda(venda);
        this.cancelarPagamento();
        this.atualizarListaVendas();
        this.atualizarResumoEvento();
        this.atualizarTotaisGerais();
    },

    editarVenda(id) {
        this.vendaEditando = id;
        const venda = this.vendas.find(v => v.id === id);
        if (!venda) return;
        
        document.getElementById('vendaCliente').value = venda.cliente || '';
        document.getElementById('vendaProdutoId').value = venda.produto_id || '';
        document.getElementById('vendaQtd').value = venda.quantidade || 1;
        document.getElementById('vendaValorUnit').value = venda.valor_unit || 0;
        document.getElementById('vendaTotal').value = (venda.quantidade * venda.valor_unit).toFixed(2);
        document.getElementById('vendaFormaPagamento').value = venda.forma_pagamento || 'dinheiro';
        document.getElementById('vendaValorPago').value = venda.valor_pago || 0;
        document.getElementById('vendaEntrega').value = venda.entrega || 'nao';
        document.getElementById('vendaObs').value = venda.observacoes || '';
        
        this.calcularPendenteVenda();
        document.getElementById('formVenda').classList.remove('hidden');
    },

    async removerVenda(id) {
        if (confirm('Remover esta venda?')) {
            const venda = this.vendas.find(v => v.id === id);
            if (venda) {
                const produto = this.producao.find(p => p.id === venda.produto_id);
                if (produto) {
                    produto.vendido = Math.max(0, (produto.vendido || 0) - venda.quantidade);
                    await this.salvarProducao(produto);
                }
            }
            
            await this.deletarVenda(id);
            this.atualizarListaProducao();
            this.atualizarListaVendas();
            this.atualizarResumoEvento();
            this.atualizarSelectProdutos();
            this.atualizarTotaisGerais();
        }
    },

    // ========== TOTAIS GERAIS ==========
    atualizarTotaisGerais() {
        let totalVendasHoje = 0;
        let totalVendasGeral = 0;
        let totalRecebidoGeral = 0;
        let totalCustosGeral = 0;

        const hoje = new Date();
        const hojeKey = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

        // Calcular vendas
        this.vendas.forEach(venda => {
            const valorTotal = venda.quantidade * venda.valor_unit;
            totalVendasGeral += valorTotal;
            totalRecebidoGeral += venda.valor_pago || 0;
            
            const evento = Object.values(this.eventos).find(e => e.id === venda.evento_id);
            if (evento && Object.keys(this.eventos).find(key => this.eventos[key].id === venda.evento_id) === hojeKey) {
                totalVendasHoje += valorTotal;
            }
        });
        
        // Calcular custos
        this.ingredientes.forEach(ing => {
            if (!ing.doacao) {
                totalCustosGeral += ing.valor_total || 0;
            }
        });

        const liquidoGeral = totalRecebidoGeral - totalCustosGeral;

        const vendasHojeEl = document.getElementById('resumoVendasHoje');
        const vendasGeralEl = document.getElementById('resumoVendasGeral');
        const recebidoGeralEl = document.getElementById('resumoRecebidoGeral');
        const liquidoEl = document.getElementById('resumoLiquido');

        if (vendasHojeEl) vendasHojeEl.innerHTML = `R$ ${totalVendasHoje.toFixed(2)}`;
        if (vendasGeralEl) vendasGeralEl.innerHTML = `R$ ${totalVendasGeral.toFixed(2)}`;
        if (recebidoGeralEl) recebidoGeralEl.innerHTML = `R$ ${totalRecebidoGeral.toFixed(2)}`;
        if (liquidoEl) liquidoEl.innerHTML = `R$ ${liquidoGeral.toFixed(2)}`;
    },

    // ========== RELATÓRIOS ==========
    atualizarRelatorioEvento() {
        if (!this.selectedEventoId) return;

        const producao = this.producao.filter(p => p.evento_id === this.selectedEventoId);
        const ingredientes = this.ingredientes.filter(i => i.evento_id === this.selectedEventoId);
        const vendas = this.vendas.filter(v => v.evento_id === this.selectedEventoId);
        const comprovantes = this.comprovantes.filter(c => c.evento_id === this.selectedEventoId);
        
        const totalCustos = ingredientes.reduce((acc, item) => acc + (item.doacao ? 0 : (item.valor_total || 0)), 0);
        const totalComprado = ingredientes
            .filter(item => item.comprado && !item.doacao && item.valor_total > 0)
            .reduce((acc, item) => acc + (item.valor_total || 0), 0);
        const itensComprados = ingredientes.filter(item => item.comprado).length;
        const itensSemValor = ingredientes.filter(item => (item.valor_total === 0 || !item.valor_total) && !item.doacao).length;
        
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
            const valorTotal = venda.quantidade * venda.valor_unit;
            totalVendas += valorTotal;
            totalRecebido += venda.valor_pago || 0;

            if (venda.entrega === 'sim') totalEntregues++;

            switch(venda.forma_pagamento) {
                case 'dinheiro': totalDinheiro += venda.valor_pago || 0; break;
                case 'pix_veri': totalPixVeri += venda.valor_pago || 0; break;
                case 'pix_jheni': totalPixJheni += venda.valor_pago || 0; break;
                case 'debito': totalDebito += venda.valor_pago || 0; break;
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
        if (semValorRow) {
            semValorRow.querySelector('.report-value').innerHTML = itensSemValor;
        }
    },

    // ========== NAVEGAÇÃO ==========
    async excluirEvento() {
        if (!this.selectedEventoId) return;
        
        if (confirm('🗑️ Excluir este evento permanentemente?')) {
            // Deletar todos os dados relacionados
            const vendas = this.vendas.filter(v => v.evento_id === this.selectedEventoId);
            for (const v of vendas) {
                await this.deletarVenda(v.id);
            }
            
            const comprovantes = this.comprovantes.filter(c => c.evento_id === this.selectedEventoId);
            for (const c of comprovantes) {
                await this.deletarComprovante(c.id);
            }
            
            const ingredientes = this.ingredientes.filter(i => i.evento_id === this.selectedEventoId);
            for (const i of ingredientes) {
                await this.deletarIngrediente(i.id);
            }
            
            const producao = this.producao.filter(p => p.evento_id === this.selectedEventoId);
            for (const p of producao) {
                await this.deletarProducao(p.id);
            }
            
            // Deletar o evento
            try {
                await fetch(`${SUPABASE_URL}/rest/v1/eventos?id=eq.${this.selectedEventoId}`, {
                    method: 'DELETE',
                    headers: headers
                });
            } catch (error) {
                console.error('Erro ao remover evento:', error);
            }
            
            delete this.eventos[this.selectedDay];
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
        const totalEventos = Object.keys(this.eventos).length;
        let totalVendas = 0;
        let totalRecebido = 0;
        let totalCustos = 0;

        this.vendas.forEach(venda => {
            totalVendas += venda.quantidade * venda.valor_unit;
            totalRecebido += venda.valor_pago || 0;
        });

        this.ingredientes.forEach(ing => {
            if (!ing.doacao) totalCustos += ing.valor_total || 0;
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