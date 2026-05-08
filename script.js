// Configuração do Supabase - VERIFIQUE SE ESTAS CHAVES ESTÃO CORRETAS!
const SUPABASE_URL = 'https://uqfznchyfcidyqlqauua.supabase.co';
// IMPORTANTE: Esta chave parece ser uma publishable key. Você precisa usar a anon key do Supabase!
// A anon key normalmente começa com "eyJ..." e é diferente da publishable key
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxZnpuY2h5ZmNpZHlxbHFhdXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5OTI4NzUsImV4cCI6MjA4NjU2ODg3NX0.eGvAs-vgw96PYp0xqtrt4NieEcUE36WdfP9r8h22Jd0';

// Headers para as requisições
const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Prefer': 'return=representation'
};

// Nomes das tabelas no Supabase
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

    async init() {
        this.mostrarLoading();
        await this.carregarEventos();
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

    async carregarEventos() {
    try {
        console.log('Carregando eventos do Supabase...');
        
        // Buscar eventos
        const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.EVENTOS}?order=created_at.desc`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro ao carregar eventos: ${response.status}`);
        }
        
        const eventos = await response.json();
        console.log('Eventos carregados:', eventos);
        
        this.events = {};
        
        // Para cada evento, buscar seus dados relacionados
        for (const evento of eventos) {
            const data = evento.data;
            
            try {
                // Buscar produção
                const producaoRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/${TABLES.PRODUCAO}?evento_id=eq.${evento.id}&select=*`,
                    { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
                );
                const producao = producaoRes.ok ? await producaoRes.json() : [];
                
                // Buscar comprovantes
                const comprovantesRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/${TABLES.COMPROVANTES}?evento_id=eq.${evento.id}&select=*`,
                    { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
                );
                const comprovantes = comprovantesRes.ok ? await comprovantesRes.json() : [];
                
                // Buscar ingredientes
                const ingredientesRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}?evento_id=eq.${evento.id}&select=*`,
                    { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
                );
                const ingredientes = ingredientesRes.ok ? await ingredientesRes.json() : [];
                
                // Buscar vendas
                const vendasRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/${TABLES.VENDAS}?evento_id=eq.${evento.id}&select=*`,
                    { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
                );
                const vendas = vendasRes.ok ? await vendasRes.json() : [];
                
                this.events[data] = {
                    id: evento.id,
                    eventName: evento.eventName || '',
                    responsible: evento.responsible || '',
                    notes: evento.notes || '',
                    producao: producao || [],
                    comprovantes: comprovantes || [],
                    ingredientes: ingredientes || [],
                    vendas: vendas || []
                };
            } catch (error) {
                console.error(`Erro ao carregar dados do evento ${data}:`, error);
                this.events[data] = {
                    id: evento.id,
                    eventName: evento.eventName || '',
                    responsible: evento.responsible || '',
                    notes: evento.notes || '',
                    producao: [],
                    comprovantes: [],
                    ingredientes: [],
                    vendas: []
                };
            }
        }
        
        console.log('Eventos processados:', this.events);
        
        // Backup local APENAS dos metadados, sem imagens
        const eventsBackup = {};
        for (const [data, event] of Object.entries(this.events)) {
            eventsBackup[data] = {
                ...event,
                comprovantes: event.comprovantes.map(c => ({
                    ...c,
                    imagem: null // Não salvar imagem no localStorage
                }))
            };
        }
        
        try {
            localStorage.setItem('cantinaEvents', JSON.stringify(eventsBackup));
        } catch (e) {
            console.warn('Não foi possível fazer backup no localStorage (quota excedida)');
        }
        
    } catch (error) {
        console.error('Erro ao carregar eventos:', error);
        
        // Tentar carregar backup local (sem imagens)
        try {
            const localData = localStorage.getItem('cantinaEvents');
            if (localData) {
                this.events = JSON.parse(localData);
                console.log('Usando backup local (sem imagens)');
            } else {
                this.events = {};
            }
        } catch (e) {
            console.error('Erro ao carregar backup local:', e);
            this.events = {};
        }
    }
},

async sincronizarVendasComProducao() {
    if (!this.selectedDay || !this.events[this.selectedDay]) return;
    
    try {
        this.mostrarLoading();
        
        const evento = this.events[this.selectedDay];
        const vendas = evento.vendas || [];
        const producao = evento.producao || [];
        
        // Para cada produto, recalcular o total vendido com base nas vendas
        for (const produto of producao) {
            // Calcular quantas unidades deste produto foram vendidas
            const totalVendido = vendas
                .filter(v => String(v.produtoId) === String(produto.id))
                .reduce((acc, venda) => acc + venda.quantidade, 0);
            
            // Se o valor no produto estiver diferente do calculado, atualizar
            if ((produto.vendido || 0) !== totalVendido) {
                console.log(`Sincronizando ${produto.nome}: ${produto.vendido || 0} -> ${totalVendido}`);
                
                // Atualizar no Supabase
                await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.PRODUCAO}?id=eq.${produto.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify({ vendido: totalVendido })
                });
            }
        }
        
        // Recarregar os dados
        await this.carregarEventos();
        this.carregarDadosEvento();
        
        alert('✅ Vendas sincronizadas com produção!');
        
    } catch (error) {
        console.error('Erro ao sincronizar:', error);
        alert('Erro ao sincronizar dados');
    } finally {
        this.esconderLoading();
    }
},

    async getOrCreateEventoId(data) {
    try {
        console.log('🔍 Buscando evento para data:', data);
        
        // Verificar no Supabase
        const checkResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/eventos?data=eq.${data}&select=id`,
            { 
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );
        
        if (!checkResponse.ok) {
            console.error('Erro na consulta:', checkResponse.status);
            return null;
        }
        
        const existente = await checkResponse.json();
        console.log('Eventos encontrados:', existente);
        
        if (existente && existente.length > 0) {
            console.log('✅ Evento existente ID:', existente[0].id);
            return existente[0].id;
        }
        
        // Se não existir, criar novo
        console.log('➕ Criando novo evento para:', data);
        
        const novoEvento = {
            data: data,
            eventName: '',
            responsible: '',
            notes: ''
        };
        
        const createResponse = await fetch(`${SUPABASE_URL}/rest/v1/eventos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(novoEvento)
        });
        
        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('Erro ao criar:', createResponse.status, errorText);
            return null;
        }
        
        const criado = await createResponse.json();
        console.log('✅ Evento criado:', criado);
        
        // Retornar o ID do evento criado
        if (Array.isArray(criado) && criado.length > 0) {
            return criado[0].id;
        } else if (criado && criado.id) {
            return criado.id;
        } else {
            console.error('Resposta inesperada:', criado);
            return null;
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
        return null;
    }
},

    async atualizarEventoNoSupabase(data, campos) {
        try {
            const eventoId = await this.getOrCreateEventoId(data);
            if (!eventoId) throw new Error('Evento não encontrado');
            
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.EVENTOS}?id=eq.${eventoId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    ...campos,
                    updated_at: new Date().toISOString()
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erro ao atualizar evento:', errorText);
                throw new Error('Erro ao atualizar evento');
            }
            
            // Atualizar objeto local
            if (this.events[data]) {
                this.events[data] = { ...this.events[data], ...campos, id: eventoId };
            }
            
            localStorage.setItem('cantinaEvents', JSON.stringify(this.events));
            
        } catch (error) {
            console.error('Erro ao atualizar evento:', error);
            throw error;
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

    async abrirDia(dataKey) {
        this.mostrarLoading();
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
            
            // Criar evento no Supabase
            await this.getOrCreateEventoId(dataKey);
        }

        const [ano, mes, dia] = dataKey.split('-');
        document.getElementById('selectedDate').innerHTML = `📅 ${dia}/${mes}/${ano}`;
        
        this.carregarDadosEvento();
        
        document.getElementById('calendarSection').classList.add('hidden');
        document.getElementById('managementSection').classList.remove('hidden');
        this.mudarAba('evento');
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
        } else if (aba === 'relatorio') {
            document.querySelector('.tab-btn:nth-child(4)').classList.add('active');
            document.getElementById('tabRelatorio').classList.add('active');
            this.atualizarRelatorioEvento();
        }
    },

    async salvarEvento() {
    if (!this.selectedDay) {
        alert('Nenhum dia selecionado!');
        return;
    }

    const eventName = document.getElementById('eventName').value;
    const responsible = document.getElementById('responsible').value;
    const notes = document.getElementById('notes').value;

    try {
        this.mostrarLoading();
        
        console.log('Salvando evento para data:', this.selectedDay);
        
        // Primeiro, garantir que o evento existe
        const eventoId = await this.getOrCreateEventoId(this.selectedDay);
        console.log('Evento ID obtido:', eventoId);
        
        if (!eventoId) {
            throw new Error('Não foi possível obter/criar o evento');
        }

        // Atualizar o evento
        const updateData = {
            eventName: eventName,
            responsible: responsible,
            notes: notes,
            updated_at: new Date().toISOString()
        };
        
        console.log('Atualizando evento ID', eventoId, 'com dados:', updateData);

        const response = await fetch(`${SUPABASE_URL}/rest/v1/eventos?id=eq.${eventoId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(updateData)
        });

        console.log('Resposta do Supabase (PATCH):', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro na resposta do Supabase (PATCH):', errorText);
            throw new Error(`Erro ao atualizar evento: ${response.status}`);
        }

        // Atualizar objeto local
        if (!this.events[this.selectedDay]) {
            this.events[this.selectedDay] = {
                producao: [],
                ingredientes: [],
                vendas: [],
                comprovantes: []
            };
        }
        
        this.events[this.selectedDay].id = eventoId;
        this.events[this.selectedDay].eventName = eventName;
        this.events[this.selectedDay].responsible = responsible;
        this.events[this.selectedDay].notes = notes;

        // Backup local
        localStorage.setItem('cantinaEvents', JSON.stringify(this.events));

        // Atualizar UI
        document.getElementById('selectedEventName').innerHTML = eventName || 'Novo Evento';
        document.getElementById('selectedResponsible').innerHTML = `👤 ${responsible || 'Clique para editar'}`;

        // Feedback visual - AGORA SEM USAR event.target
        const btn = document.querySelector('.btn-primary[onclick="app.salvarEvento()"]');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span>✅</span> Salvo!';
            btn.style.background = '#10b981';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = '';
            }, 1500);
        }
        
        console.log('Evento salvo com sucesso!');
        
    } catch (error) {
        console.error('Erro detalhado ao salvar evento:', error);
        alert(`Erro ao salvar evento: ${error.message}`);
    } finally {
        this.esconderLoading();
    }
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

        const id = document.getElementById('producaoEditId').value;
        const nome = document.getElementById('producaoNome').value;
        const quantidade = parseInt(document.getElementById('producaoQuantidade').value) || 0;
        const valor = parseFloat(document.getElementById('producaoValor').value) || 0;

        if (!nome || quantidade <= 0 || valor <= 0) {
            alert('Preencha todos os campos corretamente!');
            return;
        }

        try {
            this.mostrarLoading();
            
            const eventoId = await this.getOrCreateEventoId(this.selectedDay);
            if (!eventoId) throw new Error('Erro ao obter evento');

            // Se for edição, buscar o item atual para preservar o vendido
            let vendidoAtual = 0;
            if (this.producaoEditando) {
                const itemExistente = this.events[this.selectedDay]?.producao.find(p => String(p.id) === String(this.producaoEditando));
                if (itemExistente) {
                    vendidoAtual = itemExistente.vendido || 0;
                }
            }

            const producaoData = {
                evento_id: eventoId,
                nome: nome,
                quantidade: quantidade,
                valor: valor,
                vendido: vendidoAtual  // Preservar o valor atual de vendido
            };

            if (this.producaoEditando) {
                // Atualizar
                const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.PRODUCAO}?id=eq.${this.producaoEditando}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify(producaoData)
                });

                if (!response.ok) {
                    throw new Error('Erro ao atualizar produção');
                }
            } else {
                // Criar novo (aqui sim, vendido começa como 0)
                const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.PRODUCAO}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(producaoData)
                });

                if (!response.ok) {
                    throw new Error('Erro ao criar produção');
                }
            }

            // Recarregar dados
            await this.carregarEventos();
            
            this.cancelarFormProducao();
            this.carregarDadosEvento();
            
            // Feedback visual
            const btn = document.querySelector('[onclick="app.salvarProducao()"]');
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = '<span>✅</span> Salvo!';
                btn.style.background = '#10b981';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = '';
                }, 1500);
            }
            
        } catch (error) {
            console.error('Erro ao salvar produção:', error);
            alert(`Erro ao salvar: ${error.message}`);
        } finally {
            this.esconderLoading();
        }
    },

    async removerProducao(id) {
        if (!confirm('Remover este prato?')) return;

        try {
            this.mostrarLoading();
            
            await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.PRODUCAO}?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            
            await this.carregarEventos();
            this.carregarDadosEvento();
            
        } catch (error) {
            console.error('Erro ao remover produção:', error);
            alert('Erro ao remover item!');
        } finally {
            this.esconderLoading();
        }
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

            // Calcular valor total potencial
            const valorTotalPotencial = item.quantidade * item.valor;
            const valorVendido = (item.vendido || 0) * item.valor;
            const valorDisponivel = disponivel * item.valor;

            html += `
                <div class="item-card" style="border-left-color: var(--success);">
                    <div class="item-info">
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span class="item-name">${item.nome}</span>
                            <span class="item-badge" style="background: var(--primary);">R$ ${item.valor.toFixed(2)}</span>
                            ${disponivel > 0 ? 
                                `<span class="item-badge" style="background: var(--warning);">${disponivel} disponível</span>` : 
                                `<span class="item-badge" style="background: var(--danger);">Esgotado</span>`}
                        </div>
                        <span class="item-details">
                            Produzido: ${item.quantidade} • Vendido: ${item.vendido || 0} • Disponível: ${disponivel}
                        </span>
                        <div style="display: flex; gap: 10px; margin-top: 4px; font-size: 0.8rem;">
                            <span>💰 Potencial: R$ ${valorTotalPotencial.toFixed(2)}</span>
                            <span>✅ Vendido: R$ ${valorVendido.toFixed(2)}</span>
                            <span>📦 A vender: R$ ${valorDisponivel.toFixed(2)}</span>
                        </div>
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

    // ========== INGREDIENTES ==========
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

        const id = document.getElementById('ingredienteEditId').value;
        const nome = document.getElementById('ingredienteNome').value;
        const quantidade = parseFloat(document.getElementById('ingredienteQtd').value) || 0;
        const unidade = document.getElementById('ingredienteUnidade').value;
        const valorTotal = parseFloat(document.getElementById('ingredienteValor').value) || 0;
        const comprado = document.getElementById('ingredienteComprado').checked;
        const doacao = document.getElementById('ingredienteDoacao').checked;
        const comprovanteId = document.getElementById('ingredienteComprovanteId').value || null;

        if (!nome || quantidade <= 0) {
            alert('Preencha todos os campos corretamente!');
            return;
        }

        try {
            this.mostrarLoading();
            
            const eventoId = await this.getOrCreateEventoId(this.selectedDay);
            if (!eventoId) throw new Error('Erro ao obter evento');

            const ingredienteData = {
                evento_id: eventoId,
                nome: nome,
                quantidade: quantidade,
                unidade: unidade,
                valorTotal: valorTotal,
                comprado: comprado,
                doacao: doacao,
                comprovante_id: comprovanteId
            };

            if (this.ingredienteEditando) {
                // Atualizar
                await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}?id=eq.${this.ingredienteEditando}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify(ingredienteData)
                });
            } else {
                // Criar novo
                await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(ingredienteData)
                });
            }

            // Recarregar dados
            await this.carregarEventos();
            
            this.cancelarFormIngrediente();
            this.carregarDadosEvento();
            
        } catch (error) {
            console.error('Erro ao salvar ingrediente:', error);
            alert('Erro ao salvar no banco de dados');
        } finally {
            this.esconderLoading();
        }
    },

    async removerIngrediente(id) {
        if (!confirm('Remover este ingrediente?')) return;

        try {
            this.mostrarLoading();
            
            await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            
            await this.carregarEventos();
            this.carregarDadosEvento();
            
        } catch (error) {
            console.error('Erro ao remover ingrediente:', error);
            alert('Erro ao remover item!');
        } finally {
            this.esconderLoading();
        }
    },

    async toggleCompradoIngrediente(id) {
        try {
            this.mostrarLoading();
            
            const ingrediente = this.events[this.selectedDay].ingredientes.find(i => String(i.id) === String(id));
            if (ingrediente) {
                await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}?id=eq.${id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify({ comprado: !ingrediente.comprado })
                });
                
                await this.carregarEventos();
                this.carregarDadosEvento();
            }
            
        } catch (error) {
            console.error('Erro ao atualizar ingrediente:', error);
            alert('Erro ao atualizar!');
        } finally {
            this.esconderLoading();
        }
    },

    atualizarListaIngredientes() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const ingredientes = this.events[this.selectedDay].ingredientes || [];
        const comprovantes = this.events[this.selectedDay].comprovantes || [];
        let html = '';

        ingredientes.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

        ingredientes.forEach((item) => {
            const compradoClass = item.comprado ? 'comprado' : '';
            const compradoText = item.comprado ? '✅' : '⏳';
            
            const valorDisplay = item.valorTotal > 0 ? `R$ ${item.valorTotal.toFixed(2)}` : '💰 A definir';
            
            const temComprovante = item.comprovante_id ? true : false;
            const comprovante = temComprovante ? comprovantes.find(c => String(c.id) === String(item.comprovante_id)) : null;
            
            html += `
                <div class="item-card ${compradoClass}" data-id="${item.id}" style="${item.comprado ? 'opacity: 0.8;' : ''}">
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
                                <button class="btn-icon" style="background: var(--primary); width: 24px; height: 24px; font-size: 0.8rem;" onclick="app.verComprovanteDoIngrediente('${item.comprovante_id}')" title="Ver comprovante">
                                    👁️
                                </button>
                            </div>
                        ` : ''}
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

    verComprovanteDoIngrediente(comprovanteId) {
        if (!comprovanteId) return;
        
        const comprovante = this.events[this.selectedDay].comprovantes.find(c => String(c.id) === String(comprovanteId));
        this.mostrarComprovanteEmJanela(comprovante);
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
                    .filter(i => String(i.comprovante_id) === String(comprovante.id))
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

    async comprimirImagem(file, maxWidth = 1024, qualidade = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (readerEvent) => {
            const image = new Image();
            image.src = readerEvent.target.result;
            image.onload = () => {
                const canvas = document.createElement('canvas');
                let width = image.width;
                let height = image.height;
                
                if (width > maxWidth) {
                    height = Math.round(height * (maxWidth / width));
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, width, height);
                
                const imagemComprimida = canvas.toDataURL('image/jpeg', qualidade);
                resolve(imagemComprimida);
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
        
        // Na função salvarComprovante, substitua a parte da imagem por:
let imagem = null;
if (imagemInput.files && imagemInput.files[0]) {
    // Comprimir a imagem antes de salvar
    imagem = await this.comprimirImagem(imagemInput.files[0], 1024, 0.7);
}

        if (!nome) {
            alert('Digite o nome do comprovante!');
            return;
        }

        try {
            this.mostrarLoading();
            
            const eventoId = await this.getOrCreateEventoId(this.selectedDay);
            if (!eventoId) throw new Error('Erro ao obter evento');

            const comprovanteData = {
                evento_id: eventoId,
                nome: nome,
                data: data,
                valorTotal: valorTotal,
                imagem: imagem || (this.comprovanteEditando ? 
                    this.events[this.selectedDay].comprovantes.find(c => String(c.id) === String(this.comprovanteEditando))?.imagem : null)
            };

            let comprovanteId = id;

            if (this.comprovanteEditando) {
                // Atualizar
                await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.COMPROVANTES}?id=eq.${this.comprovanteEditando}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify(comprovanteData)
                });
                comprovanteId = this.comprovanteEditando;
            } else {
                // Criar novo
                const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.COMPROVANTES}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(comprovanteData)
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Erro ao criar comprovante:', errorText);
                    throw new Error('Erro ao criar comprovante');
                }
                
                const novoComprovante = await response.json();
                comprovanteId = Array.isArray(novoComprovante) ? novoComprovante[0].id : novoComprovante.id;
            }

            // Atualizar ingredientes selecionados
            if (this.ingredientesSelecionados.length > 0) {
                // Primeiro, remover vínculo dos ingredientes que estavam neste comprovante
                if (this.comprovanteEditando) {
                    await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}?comprovante_id=eq.${this.comprovanteEditando}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                        },
                        body: JSON.stringify({ comprovante_id: null })
                    });
                }
                
                // Vincular ingredientes selecionados
                for (const ingId of this.ingredientesSelecionados) {
                    await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}?id=eq.${ingId}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                        },
                        body: JSON.stringify({ comprovante_id: comprovanteId })
                    });
                }
            }

            // Recarregar dados
            await this.carregarEventos();
            
            this.cancelarFormComprovante();
            this.carregarDadosEvento();
            
        } catch (error) {
            console.error('Erro ao salvar comprovante:', error);
            alert('Erro ao salvar no banco de dados');
        } finally {
            this.esconderLoading();
        }
    },

    async removerComprovante(id) {
        if (!confirm('Remover este comprovante? Os itens vinculados serão desvinculados.')) return;

        try {
            this.mostrarLoading();
            
            // Desvincular ingredientes
            await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.INGREDIENTES}?comprovante_id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ comprovante_id: null })
            });
            
            // Remover comprovante
            await fetch(`${SUPABASE_URL}/rest/v1/${TABLES.COMPROVANTES}?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            
            await this.carregarEventos();
            this.carregarDadosEvento();
            
        } catch (error) {
            console.error('Erro ao remover comprovante:', error);
            alert('Erro ao remover comprovante!');
        } finally {
            this.esconderLoading();
        }
    },

    atualizarListaComprovantes() {
        if (!this.selectedDay || !this.events[this.selectedDay]) return;

        const comprovantes = this.events[this.selectedDay].comprovantes || [];
        const ingredientes = this.events[this.selectedDay].ingredientes || [];
        let html = '';

        comprovantes.forEach((comp) => {
            const itensVinculados = ingredientes
                .filter(i => String(i.comprovante_id) === String(comp.id));
            
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
        const itensVinculados = ingredientes.filter(i => String(i.comprovante_id) === String(comprovante.id));
        
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
                            <h
