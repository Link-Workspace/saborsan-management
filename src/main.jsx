import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Boxes,
  Truck,
  Users,
  Wallet,
  BarChart3,
  Bot,
  LogOut,
  Bell,
  Search,
  Filter,
  PackageCheck,
  Building2,
  MessageCircle,
  Route,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Plus,
  X,
  ChevronRight,
  Smartphone,
  Store,
  ReceiptText,
  Send,
  CalendarDays,
  ShieldCheck,
  Sparkles,
  Settings2,
  UserRound,
  Factory,
  FileSignature,
  MapPin,
  CreditCard,
  TrendingUp,
} from 'lucide-react'
import './styles.css'

const money = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const products = [
  { id: 1, name: 'Pão de Queijo Tradicional', category: 'Pão de queijo', image: '/images/pao-de-queijo-real.jpg', stock: 142, min: 60, price: 128.9, supplier: 'Queijos Serra Alta', temperature: '-18°C', unit: 'cx 5kg' },
  { id: 2, name: 'Mini Pizza Congelada', category: 'Assados', image: '/images/mini-pizza-1.jpg', stock: 88, min: 55, price: 96.5, supplier: 'Forno Sul Alimentos', temperature: '-18°C', unit: 'cx 30 un' },
  { id: 3, name: 'Açaí Premium Balde', category: 'Açaí', image: '/images/acai-real.avif', stock: 31, min: 40, price: 154.9, supplier: 'Amazônia Mix', temperature: '-18°C', unit: 'balde 10L' },
  { id: 4, name: 'Croissant Folhado', category: 'Croissant', image: '/images/croissant-real.avif', stock: 67, min: 35, price: 112.0, supplier: 'La Maison Congelados', temperature: '-18°C', unit: 'cx 40 un' },
  { id: 5, name: 'Mix de Salgados', category: 'Salgados', image: '/images/salgados-real.jpg', stock: 54, min: 50, price: 89.7, supplier: 'Salgados San Pietro', temperature: '-18°C', unit: 'cx 100 un' },
  { id: 6, name: 'Polpas de Frutas Sortidas', category: 'Polpas', image: '/images/linha-mercados-real.png', stock: 210, min: 120, price: 48.5, supplier: 'Frutas do Vale', temperature: '-18°C', unit: 'pct 20 un' },
]

const initialOrders = [
  {
    id: 'PED-2049',
    source: 'App Saborsan',
    customer: 'Padaria Bela Vista',
    cnpj: '12.345.678/0001-90',
    city: 'Lages - SC',
    whatsapp: '(49) 99988-1040',
    value: 1984.6,
    status: 'Recebido',
    priority: 'Alta',
    time: '08:42',
    delivery: 'Hoje, 15:30',
    products: [
      { name: 'Pão de Queijo Tradicional', qty: 8, unit: 'cx', price: 128.9 },
      { name: 'Croissant Folhado', qty: 5, unit: 'cx', price: 112.0 },
      { name: 'Polpas de Frutas Sortidas', qty: 8, unit: 'pct', price: 48.5 },
    ],
    notes: 'Cliente solicitou entrega no período da tarde. Conferir espaço no freezer antes da descarga.',
  },
  {
    id: 'PED-2048',
    source: 'WhatsApp',
    customer: 'Café Avenida',
    cnpj: '22.987.444/0001-12',
    city: 'Lages - SC',
    whatsapp: '(49) 99111-2230',
    value: 1297.2,
    status: 'Separação',
    priority: 'Normal',
    time: '09:18',
    delivery: 'Hoje, 17:00',
    products: [
      { name: 'Croissant Folhado', qty: 6, unit: 'cx', price: 112.0 },
      { name: 'Mini Pizza Congelada', qty: 5, unit: 'cx', price: 96.5 },
      { name: 'Açaí Premium Balde', qty: 1, unit: 'balde', price: 154.9 },
    ],
    notes: 'Separar materiais promocionais junto com o pedido.',
  },
  {
    id: 'PED-2047',
    source: 'App Saborsan',
    customer: 'Mercado Santa Clara',
    cnpj: '07.555.121/0001-04',
    city: 'Correia Pinto - SC',
    whatsapp: '(49) 98872-3344',
    value: 2880.3,
    status: 'Rota',
    priority: 'Normal',
    time: '07:55',
    delivery: 'Hoje, 12:10',
    products: [
      { name: 'Mix de Salgados', qty: 12, unit: 'cx', price: 89.7 },
      { name: 'Pão de Queijo Tradicional', qty: 10, unit: 'cx', price: 128.9 },
      { name: 'Polpas de Frutas Sortidas', qty: 10, unit: 'pct', price: 48.5 },
    ],
    notes: 'Pedido recorrente semanal. Conferir boleto anterior antes da emissão.',
  },
  {
    id: 'PED-2046',
    source: 'Vendedor',
    customer: 'Restaurante Dom Sabor',
    cnpj: '35.777.001/0001-99',
    city: 'Lages - SC',
    whatsapp: '(49) 98455-8870',
    value: 953.8,
    status: 'Entregue',
    priority: 'Normal',
    time: 'Ontem',
    delivery: 'Entregue ontem',
    products: [
      { name: 'Mini Pizza Congelada', qty: 4, unit: 'cx', price: 96.5 },
      { name: 'Açaí Premium Balde', qty: 2, unit: 'balde', price: 154.9 },
      { name: 'Pão de Queijo Tradicional', qty: 2, unit: 'cx', price: 128.9 },
    ],
    notes: 'Cliente elogiou o atendimento. Oferecer croissant no próximo contato.',
  },
]

const suppliers = [
  { id: 1, name: 'Queijos Serra Alta', type: 'Laticínios e massas', contact: 'Marcos', phone: '(49) 99910-1111', status: 'Ativo', lead: '2 dias', pending: 'Reposição de pão de queijo', reliability: 96 },
  { id: 2, name: 'Forno Sul Alimentos', type: 'Assados e pizzas', contact: 'Carolina', phone: '(48) 99122-4400', status: 'Ativo', lead: '3 dias', pending: 'Tabela de preço mensal', reliability: 91 },
  { id: 3, name: 'Amazônia Mix', type: 'Açaí e sobremesas', contact: 'Rafael', phone: '(47) 99700-2211', status: 'Atenção', lead: '5 dias', pending: 'Estoque de açaí baixo', reliability: 84 },
  { id: 4, name: 'Frutas do Vale', type: 'Polpas e frutas', contact: 'Fernanda', phone: '(49) 99870-4451', status: 'Ativo', lead: '2 dias', pending: 'Sem pendências', reliability: 98 },
]

const supplierTranscripts = {
  1: {
    date: 'Hoje, 08:14', status: 'Concluída',
    messages: [
      { from: 'ia', time: '08:14', text: 'Bom dia! Aqui é a IA da Saborsan Distribuidora. Preciso verificar a disponibilidade de Pão de Queijo Tradicional para reposição. Vocês têm 24 caixas de 5kg disponíveis para entrega em até 2 dias?' },
      { from: 'supplier', time: '08:17', text: 'Bom dia! Sim, temos estoque. Posso confirmar 24 caixas para entrega amanhã no período da tarde.' },
      { from: 'ia', time: '08:17', text: 'Perfeito. O valor por caixa continua R$ 128,90? E qual a forma de pagamento aceita neste pedido?' },
      { from: 'supplier', time: '08:21', text: 'Sim, mesmo valor. Aceito boleto com 15 dias ou PIX com 3% de desconto.' },
      { from: 'ia', time: '08:21', text: 'Entendido. Vou registrar a cotação com PIX (desconto aplicado). Total estimado: R$ 3.004,94. Um funcionário da Saborsan entrará em contato para confirmar o pedido. Obrigado, Marcos!' },
      { from: 'supplier', time: '08:23', text: 'Pode deixar. Qualquer coisa é só me ligar. Bom dia!' },
    ]
  },
  2: {
    date: 'Ontem, 14:30', status: 'Concluída',
    messages: [
      { from: 'ia', time: '14:30', text: 'Boa tarde, Carolina! IA da Saborsan aqui. Gostaria de solicitar a tabela de preços atualizada da linha de assados e mini pizzas para o mês de julho.' },
      { from: 'supplier', time: '14:35', text: 'Boa tarde! Claro, vou enviar por e-mail ainda hoje. Houve reajuste de 4,5% na linha de mini pizza por causa da farinha.' },
      { from: 'ia', time: '14:35', text: 'Compreendido. Pode encaminhar para compras@saborsan.com.br. Aproveito para checar: vocês têm promoção por volume para pedidos acima de 50 caixas?' },
      { from: 'supplier', time: '14:39', text: 'Sim! Acima de 50 caixas, 5% de desconto. Acima de 100, negociamos direto.' },
      { from: 'ia', time: '14:39', text: 'Anotado. Obrigada, Carolina. As informações foram registradas no sistema.' },
    ]
  },
  3: {
    date: 'Hoje, 09:50', status: 'Pendente retorno',
    messages: [
      { from: 'ia', time: '09:50', text: 'Bom dia, Rafael! IA da Saborsan. Nosso estoque de Açaí Premium está crítico — apenas 31 baldes restantes, abaixo do mínimo de 40. Precisamos de 24 baldes com urgência. Qual a disponibilidade?' },
      { from: 'supplier', time: '10:05', text: 'Bom dia! Estamos com produção limitada essa semana. Consigo 12 baldes até sexta e mais 12 na próxima terça.' },
      { from: 'ia', time: '10:05', text: 'Entendo. O prazo parcial seria aceitável. Você pode confirmar o preço do balde de 10L e se há frete incluso na entrega em Lages?' },
      { from: 'supplier', time: '10:12', text: 'R$ 154,90 o balde. Frete para Lages é por conta da Saborsan, mas posso negociar frete grátis se fechar 20 baldes ou mais de uma vez.' },
      { from: 'ia', time: '10:12', text: 'Perfeito. Vou registrar a proposta e aguardar confirmação de um funcionário da Saborsan para fechar o pedido completo. Obrigado!' },
    ]
  },
  4: {
    date: '16/06, 11:00', status: 'Concluída',
    messages: [
      { from: 'ia', time: '11:00', text: 'Bom dia, Fernanda! IA da Saborsan. Verificando disponibilidade de Polpas de Frutas Sortidas — precisamos de 20 pacotes para reposição preventiva.' },
      { from: 'supplier', time: '11:03', text: 'Olá! Temos 40 pacotes em estoque. Posso separar os 20 já.' },
      { from: 'ia', time: '11:03', text: 'Ótimo! Confirma o preço de R$ 48,50 por pacote e prazo de 2 dias para entrega em Lages?' },
      { from: 'supplier', time: '11:05', text: 'Confirmado! Preço e prazo mantidos. Posso emitir a NF assim que confirmar o pedido.' },
      { from: 'ia', time: '11:05', text: 'Pedido registrado. Total: R$ 970,00. Obrigada, Fernanda, a Saborsan confirmará o pedido em breve!' },
    ]
  },
}

const clients = [
  { name: 'Padaria Bela Vista', segment: 'Padaria', lastBuy: 'Hoje', monthly: 5840, status: 'Ativo' },
  { name: 'Café Avenida', segment: 'Cafeteria', lastBuy: 'Hoje', monthly: 3120, status: 'Ativo' },
  { name: 'Mercado Santa Clara', segment: 'Mercado', lastBuy: 'Hoje', monthly: 9680, status: 'VIP' },
  { name: 'Restaurante Dom Sabor', segment: 'Restaurante', lastBuy: 'Ontem', monthly: 2410, status: 'Ativo' },
  { name: 'Conveniência Central', segment: 'Conveniência', lastBuy: '8 dias', monthly: 1720, status: 'Reativar' },
]

const deliveries = [
  { id: 'R-77', driver: 'Lucas Martins', vehicle: 'Câmara fria 01', route: 'Centro → Coral → Conta Dinheiro', stops: 7, temperature: '-17.8°C', status: 'Em rota', progress: 72 },
  { id: 'R-78', driver: 'Paulo Nunes', vehicle: 'Van refrigerada 02', route: 'Lages → Correia Pinto', stops: 4, temperature: '-18.2°C', status: 'Carregando', progress: 28 },
  { id: 'R-79', driver: 'Bruno Silva', vehicle: 'Câmara fria 03', route: 'Próxima janela', stops: 5, temperature: '-18.0°C', status: 'Planejada', progress: 10 },
]

const invoices = [
  { number: 'NF-000917', customer: 'Mercado Santa Clara', value: 2880.3, status: 'Emitida', date: 'Hoje' },
  { number: 'NF-000916', customer: 'Restaurante Dom Sabor', value: 953.8, status: 'Emitida', date: 'Ontem' },
  { number: 'NF-000915', customer: 'Padaria Serrana', value: 1780.0, status: 'Aguardando envio', date: 'Ontem' },
]

const sellers = [
  {
    id: 1, name: 'Carlos Oliveira', phone: '(49) 99821-4410', region: 'Lages - SC', avatar: 'C', status: 'Ativo',
    meta: 18000, total: 21340,
    sales: [
      { id: 'VND-301', date: 'Hoje, 09:14', customer: 'Padaria Bela Vista', city: 'Lages - SC', payment: 'Cartão de débito', value: 1984.6, products: [{ name: 'Pão de Queijo Tradicional', qty: 8 }, { name: 'Croissant Folhado', qty: 5 }] },
      { id: 'VND-298', date: 'Ontem, 14:30', customer: 'Café Avenida', city: 'Lages - SC', payment: 'Pix', value: 1297.2, products: [{ name: 'Croissant Folhado', qty: 6 }, { name: 'Mini Pizza Congelada', qty: 5 }] },
      { id: 'VND-295', date: '16/06, 10:00', customer: 'Mercado Santa Clara', city: 'Correia Pinto - SC', payment: 'Boleto', value: 2880.3, products: [{ name: 'Polípas de Frutas Sortidas', qty: 20 }, { name: 'Mix de Salgados', qty: 12 }] },
    ],
  },
  {
    id: 2, name: 'Ana Paula Ramos', phone: '(49) 99654-7723', region: 'Curitibanos - SC', avatar: 'A', status: 'Ativo',
    meta: 15000, total: 13870,
    sales: [
      { id: 'VND-302', date: 'Hoje, 11:05', customer: 'Cafeteria Central', city: 'Joinville - SC', payment: 'Cartão de débito', value: 940.0, products: [{ name: 'Pão de Queijo Tradicional', qty: 1 }, { name: 'Assados Congelados', qty: 2 }] },
      { id: 'VND-297', date: 'Ontem, 16:00', customer: 'Restaurante Dom Sabor', city: 'Curitibanos - SC', payment: 'Pix', value: 953.8, products: [{ name: 'Açaí Premium Balde', qty: 4 }, { name: 'Mix de Salgados', qty: 6 }] },
      { id: 'VND-293', date: '15/06, 13:20', customer: 'Lanchonete Express', city: 'São Cristovão - SC', payment: 'Cartão de crédito', value: 780.5, products: [{ name: 'Mini Pizza Congelada', qty: 5 }, { name: 'Croissant Folhado', qty: 3 }] },
    ],
  },
  {
    id: 3, name: 'Rafael Menezes', phone: '(49) 99342-0081', region: 'Campos Novos - SC', avatar: 'R', status: 'Ativo',
    meta: 12000, total: 9450,
    sales: [
      { id: 'VND-300', date: 'Hoje, 08:50', customer: 'Padaria Serrana', city: 'Campos Novos - SC', payment: 'Boleto', value: 1780.0, products: [{ name: 'Pão de Queijo Tradicional', qty: 10 }, { name: 'Polípas de Frutas Sortidas', qty: 8 }] },
      { id: 'VND-296', date: '16/06, 15:45', customer: 'Mercado Central', city: 'Campos Novos - SC', payment: 'Pix', value: 620.0, products: [{ name: 'Mix de Salgados', qty: 4 }, { name: 'Croissant Folhado', qty: 2 }] },
    ],
  },
]

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pedidos', label: 'Pedidos', icon: ShoppingCart },
  { id: 'vendedores', label: 'Vendedores', icon: UserRound },
  { id: 'notas', label: 'Notas', icon: FileText },
  { id: 'estoque', label: 'Estoque', icon: Boxes },
  { id: 'fornecedores', label: 'Fornecedores', icon: Factory },
  { id: 'compras', label: 'Compras', icon: ClipboardList },
  { id: 'entregas', label: 'Entregas', icon: Truck },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  { id: 'automacao', label: 'Automação', icon: Bot },
  { id: 'configuracoes', label: 'Configurações', icon: Settings2 },
]

const statusClass = (status) => {
  const s = status.toLowerCase()
  if (s.includes('recebido') || s.includes('aguardando')) return 'warning'
  if (s.includes('separação') || s.includes('rota') || s.includes('carregando')) return 'info'
  if (s.includes('entregue') || s.includes('emitida') || s.includes('ativo') || s.includes('vip')) return 'success'
  if (s.includes('atenção') || s.includes('reativar') || s.includes('baixo')) return 'danger'
  return 'neutral'
}

const notifications = [
  { id: 1, type: 'warning', icon: AlertTriangle, title: 'Estoque crítico', text: 'Açaí Premium Balde abaixo do mínimo. Apenas 31 unidades restantes.', time: 'Agora' },
  { id: 2, icon: ShoppingCart, title: 'Novo pedido recebido', text: 'PED-2049 de Padaria Bela Vista no valor de R$ 1.984,60 aguarda separação.', time: '8min' },
  { id: 3, icon: Truck, title: 'Entrega em rota', text: 'ENT-041 • Lages Centro está 72% concluída. Temperatura monitorada.', time: '22min' },
  { id: 4, icon: ReceiptText, title: 'Nota fiscal pendente', text: 'NF-000915 de Padaria Serrana aguarda envio ao cliente.', time: '1h' },
]

function NotifPanel({ onClose }) {
  return (
    <>
      <div className="notifOverlay" onClick={onClose} />
      <aside className="notifPanel">
        <div className="notifHeader">
          <h3>Notificações</h3>
          <span className="badge navy">4 novas</span>
          <button className="notifClose" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="notifList">
          {notifications.map(({ id, icon: Icon, title, text, time, type }) => (
            <div className={`notifItem${type === 'warning' ? ' notifWarning' : ''}`} key={id}>
              <div className="notifIcon"><Icon size={18} /></div>
              <div className="notifBody">
                <b>{title}</b>
                <p>{text}</p>
              </div>
              <small>{time}</small>
            </div>
          ))}
        </div>
        <button className="notifFooter" onClick={onClose}>Marcar todas como lidas</button>
      </aside>
    </>
  )
}

function App() {
  const [logged, setLogged] = useState(false)
  const [active, setActive] = useState('dashboard')
  const [aiEnabled, setAiEnabled] = useState(true)
  const [orders, setOrders] = useState(initialOrders)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [supplierModal, setSupplierModal] = useState(null)
  const [toast, setToast] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [notaFiscalOrder, setNotaFiscalOrder] = useState(null)

  const totals = useMemo(() => {
    const today = orders.filter((o) => o.time !== 'Ontem')
    return {
      revenue: orders.reduce((sum, item) => sum + item.value, 0),
      todayCount: today.length,
      pending: orders.filter((o) => !['Entregue', 'Cancelado'].includes(o.status)).length,
      lowStock: products.filter((p) => p.stock <= p.min).length,
    }
  }, [orders])

  const notify = (message) => {
    setToast(message)
    window.clearTimeout(window.__saborsanToast)
    window.__saborsanToast = window.setTimeout(() => setToast(''), 2600)
  }

  const updateOrderStatus = (id, status) => {
    setOrders((items) => items.map((item) => item.id === id ? { ...item, status } : item))
    if (selectedOrder?.id === id) setSelectedOrder((old) => ({ ...old, status }))
    notify(`Pedido ${id} atualizado para ${status}.`)
  }

  const createInvoice = (order) => {
    updateOrderStatus(order.id, 'Nota gerada')
    notify(`Nota fiscal demonstrativa gerada para ${order.customer}.`)
  }

  if (!logged) return <Login onLogin={() => setLogged(true)} />

  const title = navItems.find((item) => item.id === active)?.label || 'Dashboard'

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brandBox">
          <img src="/images/logo-saborsan.png" alt="Saborsan" />
          <span>Sistema de Gestão</span>
        </div>
        <nav className="sideNav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={active === id ? 'active' : ''} onClick={() => setActive(id)}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sideUserCard">
          <div className="userPill"><span>L</span><div><b>Lucas</b><small>Administrador</small></div></div>
          <button className="logout" onClick={() => setLogged(false)}><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="mainPanel">
        <header className="topbar">
          <div>
            <span className="topKicker">Saborsan Distribuidora</span>
            <h1>{title}</h1>
          </div>
          <div className="searchBox topbarSearch"><Search size={17} /><input placeholder="Buscar pedidos, clientes, notas..." /></div>
          <div className="topActions">
            <button className="iconButton" onClick={() => setNotifOpen(!notifOpen)}><Bell size={19} /><span>4</span></button>
          </div>
        </header>

        <section className="mobileNav">
          {navItems.slice(0, 6).map(({ id, label, icon: Icon }) => (
            <button key={id} className={active === id ? 'active' : ''} onClick={() => setActive(id)}><Icon size={18} /><span>{label}</span></button>
          ))}
        </section>

        {active === 'dashboard' && <Dashboard totals={totals} orders={orders} aiEnabled={aiEnabled} setActive={setActive} />}
        {active === 'pedidos' && <Orders orders={orders} onSelect={setSelectedOrder} updateOrderStatus={updateOrderStatus} createInvoice={createInvoice} onGerarNota={setNotaFiscalOrder} />}
        {active === 'vendedores' && <Sellers />}
        {active === 'notas' && <Invoices orders={orders} createInvoice={createInvoice} />}
        {active === 'estoque' && <Stock onProduct={setSelectedProduct} />}
        {active === 'fornecedores' && <Suppliers onMessage={setSupplierModal} />}
        {active === 'compras' && <Purchases notify={notify} />}
        {active === 'entregas' && <Deliveries />}
        {active === 'clientes' && <Clients />}
        {active === 'financeiro' && <Finance />}
        {active === 'relatorios' && <Reports />}
        {active === 'automacao' && <Automation aiEnabled={aiEnabled} setAiEnabled={setAiEnabled} notify={notify} />}
        {active === 'configuracoes' && <Settings notify={notify} />}
      </main>

      {selectedOrder && <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} updateOrderStatus={updateOrderStatus} createInvoice={createInvoice} />}
      {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} notify={notify} />}
      {supplierModal && <SupplierModal supplier={supplierModal} onClose={() => setSupplierModal(null)} notify={notify} />}
      {notaFiscalOrder && <NotaFiscalModal order={notaFiscalOrder} onClose={() => setNotaFiscalOrder(null)} updateOrderStatus={updateOrderStatus} notify={notify} />}
      {notifOpen && <NotifPanel onClose={() => setNotifOpen(false)} />}
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  )
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const submit = (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Informe e-mail e senha para acessar o painel.')
      return
    }
    onLogin()
  }
  return (
    <main className="loginPage">
      <section className="loginHero">
        <div className="loginCard">
          <div className="loginCardTop">
            <img src="/images/logo-saborsan.png" alt="Saborsan" />
            <span className="badge navy">Painel interno</span>
          </div>
          <h1>Gestão completa para distribuição de alimentos.</h1>
          <p>Pedidos, notas, estoque, fornecedores, entregas e clientes em um painel moderno, responsivo e preparado para operação inteligente.</p>
        </div>
      </section>
      <section className="loginFormPanel">
        <form className="loginForm" onSubmit={submit}>
          <div className="formIcon"><ShieldCheck size={28} /></div>
          <h2>Acesso do funcionário</h2>
          <p>Entre com os dados de acesso para administrar a operação da Saborsan.</p>
          <label>E-mail corporativo<input type="email" placeholder="admin@saborsan.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Senha<input type="password" placeholder="123456" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          {error && <small className="errorText">{error}</small>}
          <button className="btnPrimary" type="submit">Entrar no sistema</button>
          <small className="hint">Demonstração: qualquer e-mail e senha acessam o painel.</small>
        </form>
      </section>
    </main>
  )
}

function Dashboard({ totals, orders, aiEnabled, setActive }) {
  const cards = [
    { label: 'Faturamento em pedidos', value: money(totals.revenue), icon: Wallet, tone: 'orange', detail: '+18% sobre a semana anterior' },
    { label: 'Pedidos recebidos hoje', value: totals.todayCount, icon: ShoppingCart, tone: 'navy', detail: '3 vindos do app Saborsan' },
    { label: 'Pedidos pendentes', value: totals.pending, icon: Clock3, tone: 'yellow', detail: 'Separação, rota e nota' },
    { label: 'Produtos em atenção', value: totals.lowStock, icon: AlertTriangle, tone: 'red', detail: 'Açaí precisa de reposição' },
  ]
  return (
    <div className="panelGrid">
      <section className="heroDashboard">
        <div>
          <span className="badge">Operação em tempo real</span>
          <h2>Alimentos, pedidos e entregas em uma visão só.</h2>
          <p>Acompanhe tudo o que acontece na distribuidora: solicitações do app, emissão de notas, reposição de estoque, comunicação com fornecedores e rotas de entrega.</p>
          <div className="heroButtons"><button onClick={() => setActive('pedidos')}>Ver pedidos</button><button onClick={() => setActive('automacao')}>Central de automação</button></div>
        </div>
        <img src="/images/new-work-station-2.png" alt="New work station 2" />
      </section>
      <section className="metricGrid">
        {cards.map(({ label, value, icon: Icon, tone, detail }) => (
          <article className={`metricCard ${tone}`} key={label}>
            <div><Icon size={22} /></div>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </section>
      <section className="contentGrid twoCols">
        <div className="card">
          <div className="cardHeader"><div><p>Fila de pedidos</p><h3>Solicitações recentes</h3></div><button onClick={() => setActive('pedidos')}>Abrir</button></div>
          <div className="orderList compact">
            {orders.slice(0, 4).map((order) => <OrderLine key={order.id} order={order} />)}
          </div>
        </div>
        <div className="card automationCard">
          <div className="cardHeader"><div><p>Operação assistida</p><h3>{aiEnabled ? 'Automação ativa' : 'Automação desativada'}</h3></div><Bot size={24} /></div>
          <div className="suggestions">
            <Suggestion icon={AlertTriangle} title="Comprar Açaí Premium" text="Estoque abaixo do mínimo. Sugestão: solicitar 24 baldes ao fornecedor Amazônia Mix." />
            <Suggestion icon={Route} title="Otimizar rota de hoje" text="Agrupar Centro e Coral reduz 18 min no trajeto e mantém a temperatura ideal." />
            <Suggestion icon={ReceiptText} title="Gerar nota do PED-2049" text="Pedido aprovado e com dados fiscais completos para emissão demonstrativa." />
          </div>
        </div>
      </section>
      <section className="contentGrid threeCols">
        <MiniTable title="Estoque crítico" data={products.filter((p) => p.stock <= p.min + 10).map((p) => [p.name, `${p.stock} ${p.unit}`, p.stock <= p.min ? 'Baixo' : 'Atenção'])} />
        <MiniTable title="Entregas" data={deliveries.map((d) => [d.id, d.route, d.status])} />
        <MiniTable title="Fornecedores" data={suppliers.map((s) => [s.name, s.lead, s.status])} />
      </section>
    </div>
  )
}

function Orders({ orders, onSelect, updateOrderStatus, createInvoice, onGerarNota }) {
  const [filter, setFilter] = useState('Todos')
  const filtered = filter === 'Todos' ? orders : orders.filter((o) => o.status === filter)
  return (
    <section className="pageStack">
      <div className="sectionHeader">
        <div><p>Pedidos recebidos do app, WhatsApp e vendedores</p></div>
        <button className="btnSolid"><Plus size={18} /> Novo pedido</button>
      </div>
      <div className="filtersRow">
        {['Todos', 'Recebido', 'Separação', 'Rota', 'Entregue'].map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}><Filter size={15} />{item}</button>)}
      </div>
      <div className="ordersBoard">
        {filtered.map((order) => (
          <article className="orderCard" key={order.id}>
            <div className="orderTop"><div><b>{order.id}</b><span>{order.source}</span></div><Status status={order.status} /></div>
            <h3>{order.customer}</h3>
            <p>{order.city} • {order.whatsapp}</p>
            <div className="orderProducts">{order.products.map((p) => <span key={p.name}>{p.qty} {p.unit} • {p.name}</span>)}</div>
            <div className="orderFooter"><strong>{money(order.value)}</strong><small>Entrega: {order.delivery}</small></div>
            <div className="orderActions"><button onClick={() => onSelect(order)}>Detalhes</button><button onClick={() => updateOrderStatus(order.id, 'Separação')}>Separar</button><button onClick={() => onGerarNota(order)}>Gerar nota</button></div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Invoices({ orders, createInvoice }) {
  return (
    <section className="pageStack">
      <div className="sectionHeader"><div><p>Geração e acompanhamento fiscal</p></div><button className="btnSolid"><FileSignature size={18} /> Nova nota</button></div>
      <div className="contentGrid twoCols">
        <div className="card">
          <div className="cardHeader"><div><p>Notas geradas</p><h3>Histórico fiscal</h3></div><ReceiptText /></div>
          <div className="tableLike">
            {invoices.map((n) => <div key={n.number}><b>{n.number}</b><span>{n.customer}</span><strong>{money(n.value)}</strong><Status status={n.status} /></div>)}
          </div>
        </div>
        <div className="card">
          <div className="cardHeader"><div><p>Pedidos prontos para emissão</p><h3>Gerar notas</h3></div><FileText /></div>
          <div className="tableLike actionRows">
            {orders.filter((o) => o.status !== 'Entregue').map((order) => <div key={order.id}><b>{order.id}</b><span>{order.customer}</span><strong>{money(order.value)}</strong><button onClick={() => createInvoice(order)}>Emitir demo</button></div>)}
          </div>
        </div>
      </div>
    </section>
  )
}

function Stock({ onProduct }) {
  return (
    <section className="pageStack">
      <div className="sectionHeader"><div><p>Controle de produtos congelados</p></div><button className="btnSolid"><PackageCheck size={18} /> Entrada de estoque</button></div>
      <div className="stockGrid">
        {products.map((product) => {
          const percent = Math.min(100, Math.round((product.stock / (product.min * 2)) * 100))
          return (
            <article className="stockCard" key={product.id} onClick={() => onProduct(product)}>
              <img src={product.image} alt={product.name} />
              <div className="stockBody">
                <span>{product.category}</span>
                <h3>{product.name}</h3>
                <p>{product.supplier} • {product.temperature}</p>
                <div className="stockLevel"><div style={{ width: `${percent}%` }}></div></div>
                <div className="stockMeta"><b>{product.stock} {product.unit}</b><small>Mínimo: {product.min}</small></div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function Suppliers({ onMessage }) {
  const [transcript, setTranscript] = useState(null)
  return (
    <section className="pageStack">
      <div className="sectionHeader"><div><p>Relação com fornecedores de alimentos</p></div><button className="btnSolid"><Plus size={18} /> Novo fornecedor</button></div>
      <div className="supplierGrid">
        {suppliers.map((supplier) => (
          <article className="supplierCard" key={supplier.id}>
            <div className="supplierIcon"><Factory size={24} /></div>
            <div className="supplierTop"><h3>{supplier.name}</h3><Status status={supplier.status} /></div>
            <p>{supplier.type}</p>
            <div className="supplierInfo"><span>Contato: <b>{supplier.contact}</b></span><span>Prazo médio: <b>{supplier.lead}</b></span><span>Confiabilidade: <b>{supplier.reliability}%</b></span></div>
            <div className="supplierPending"><AlertTriangle size={16} />{supplier.pending}</div>
            <div className="orderActions">
              <button onClick={() => onMessage(supplier)}>Comunicar</button>
              <button onClick={() => setTranscript(supplier)}>Ver conversa IA</button>
              <button>Solicitar cotação</button>
            </div>
          </article>
        ))}
      </div>
      {transcript && <SupplierTranscriptModal supplier={transcript} onClose={() => setTranscript(null)} />}
    </section>
  )
}

function Purchases({ notify }) {
  const purchaseSuggestions = [
    { item: 'Açaí Premium Balde', supplier: 'Amazônia Mix', qty: '24 baldes', reason: 'Estoque abaixo do mínimo e alta saída no fim de semana', value: 3717.6 },
    { item: 'Mix de Salgados', supplier: 'Salgados San Pietro', qty: '18 caixas', reason: 'Reposição preventiva para pedidos recorrentes', value: 1614.6 },
    { item: 'Croissant Folhado', supplier: 'La Maison Congelados', qty: '12 caixas', reason: 'Crescimento de 22% em cafeterias', value: 1344.0 },
  ]
  return (
    <section className="pageStack">
      <div className="sectionHeader"><div><p>Compras, reposição e cotação</p></div><button className="btnSolid"><Send size={18} /> Enviar cotações</button></div>
      <div className="contentGrid twoCols">
        <div className="card wideList">
          <div className="cardHeader"><div><p>Lista sugerida</p><h3>Reposições prioritárias</h3></div><ClipboardList /></div>
          {purchaseSuggestions.map((item) => (
            <div className="purchaseLine" key={item.item}>
              <div><b>{item.item}</b><span>{item.reason}</span><small>{item.supplier}</small></div>
              <strong>{item.qty}</strong>
              <em>{money(item.value)}</em>
              <button onClick={() => notify(`Cotação demonstrativa enviada para ${item.supplier}.`)}>Enviar</button>
            </div>
          ))}
        </div>
        <div className="card automationCard">
          <div className="cardHeader"><div><p>Planejamento</p><h3>Próximas compras</h3></div><CalendarDays /></div>
          <div className="calendarList">
            <div><b>Hoje</b><span>Enviar cotação de açaí e salgados</span></div>
            <div><b>Amanhã</b><span>Confirmar entrega da linha de assados</span></div>
            <div><b>Sexta</b><span>Revisar estoque para fim de semana</span></div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Deliveries() {
  return (
    <section className="pageStack">
      <div className="sectionHeader"><div><p>Rotas, motoristas e temperatura</p></div><button className="btnSolid"><Route size={18} /> Otimizar rotas</button></div>
      <div className="deliveryGrid">
        {deliveries.map((delivery) => (
          <article className="deliveryCard" key={delivery.id}>
            <div className="deliveryMap"><MapPin size={38} /><span>{delivery.route}</span></div>
            <div className="deliveryBody">
              <div className="supplierTop"><h3>{delivery.id} • {delivery.driver}</h3><Status status={delivery.status} /></div>
              <p>{delivery.vehicle} • {delivery.stops} paradas • {delivery.temperature}</p>
              <div className="progress"><div style={{ width: `${delivery.progress}%` }}></div></div>
              <div className="stockMeta"><b>{delivery.progress}% concluído</b><small>Temperatura monitorada</small></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Clients() {
  return (
    <section className="pageStack">
      <div className="sectionHeader"><div><p>Carteira comercial</p></div><button className="btnSolid"><Users size={18} /> Novo cliente</button></div>
      <div className="clientGrid">
        {clients.map((client) => (
          <article className="clientCard" key={client.name}>
            <div className="avatar">{client.name[0]}</div>
            <div><h3>{client.name}</h3><p>{client.segment}</p></div>
            <Status status={client.status} />
            <div className="clientStats"><span>Última compra <b>{client.lastBuy}</b></span><span>Mensal <b>{money(client.monthly)}</b></span></div>
            <div className="orderActions"><button>Histórico</button><button>Fazer contato</button></div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Finance() {
  const rows = [
    ['Recebimentos previstos', money(18420), '+12%'],
    ['Contas a receber', money(9220), '6 clientes'],
    ['Compras em aberto', money(6676), '3 fornecedores'],
    ['Margem estimada', '32,8%', '+4,1%'],
  ]
  return (
    <section className="pageStack">
      <div className="sectionHeader"><div><p>Visão financeira operacional</p></div><button className="btnSolid"><CreditCard size={18} /> Registrar pagamento</button></div>
      <div className="financeHero">
        <div><span className="badge navy">Previsão do mês</span><h2>{money(48650)}</h2><p>Receita prevista considerando pedidos realizados, recorrência de clientes e calendário comercial.</p></div>
        <TrendingUp size={78} />
      </div>
      <div className="contentGrid twoCols">
        <MiniTable title="Indicadores" data={rows} />
        <div className="card">
          <div className="cardHeader"><div><p>Fluxo de caixa</p><h3>Resumo semanal</h3></div><Wallet /></div>
          <div className="bars">
            {[54, 72, 48, 84, 66, 78, 93].map((value, index) => <div key={index}><span style={{ height: `${value}%` }}></span><small>{['S','T','Q','Q','S','S','D'][index]}</small></div>)}
          </div>
        </div>
      </div>
    </section>
  )
}

function Reports() {
  return (
    <section className="pageStack">
      <div className="sectionHeader"><div><p>Relatórios comerciais e operacionais</p></div><button className="btnSolid"><FileText size={18} /> Exportar demo</button></div>
      <div className="reportGrid">
        <ReportCard icon={BarChart3} title="Produtos mais vendidos" value="Pão de queijo lidera" text="Representa 34% das solicitações comerciais da semana." />
        <ReportCard icon={Store} title="Segmentos em crescimento" value="Cafeterias +22%" text="Croissants e polpas impulsionaram novos pedidos." />
        <ReportCard icon={Truck} title="Eficiência de entregas" value="91% no prazo" text="Rotas com câmara fria mantiveram temperatura ideal." />
        <ReportCard icon={Factory} title="Fornecedores" value="98% confiabilidade" text="Frutas do Vale e Queijos Serra Alta com melhor desempenho." />
      </div>
      <div className="card">
        <div className="cardHeader"><div><p>Análise mensal</p><h3>Resumo automático</h3></div><Sparkles /></div>
        <p className="analysisText">A operação mostra maior concentração de vendas em pão de queijo, croissants e açaí. O estoque de açaí está abaixo do ideal para o fim de semana e deve ser priorizado nas próximas compras. A carteira de cafeterias demonstra maior potencial para campanhas de combos com croissant, polpas e mini pizzas.</p>
      </div>
    </section>
  )
}

function Automation({ aiEnabled, setAiEnabled, notify }) {
  const automations = [
    ['Receber pedidos do app', 'Captura solicitações, organiza itens e direciona para separação.', true],
    ['Sugerir reposição de estoque', 'Analisa mínimo, giro e produtos em atenção.', true],
    ['Gerar nota fiscal demo', 'Prepara dados fiscais do pedido antes da emissão.', true],
    ['Otimizar rotas de entrega', 'Agrupa regiões, horários e veículos refrigerados.', true],
    ['Comunicar fornecedores', 'Monta mensagens de cotação e reposição.', false],
    ['Acompanhar clientes parados', 'Identifica clientes que podem receber nova oferta.', true],
  ]
  return (
    <section className="pageStack">
      <div className="sectionHeader"><div><p>Configurações inteligentes do sistema</p></div><label className="switch big"><input type="checkbox" checked={aiEnabled} onChange={() => setAiEnabled(!aiEnabled)} /><span></span></label></div>
      <div className="automationHero">
        <div><Bot size={34} /><h2>{aiEnabled ? 'Automação ativa na operação' : 'Operação manual ativada'}</h2><p>Controle como o painel apoia pedidos, estoque, compras, notas, fornecedores, clientes e entregas.</p></div>
        <button onClick={() => notify('Rotina demonstrativa executada com sucesso.')}>Executar rotina agora</button>
      </div>
      <div className="automationGrid">
        {automations.map(([title, text, active]) => <article key={title} className={active && aiEnabled ? 'on' : ''}><Settings2 size={22} /><div><h3>{title}</h3><p>{text}</p></div><span>{active && aiEnabled ? 'Ativo' : 'Manual'}</span></article>)}
      </div>
    </section>
  )
}

function OrderModal({ order, onClose, updateOrderStatus, createInvoice }) {
  return (
    <div className="modalBackdrop">
      <div className="detailModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader"><div><span>{order.id}</span><h2>{order.customer}</h2><p>{order.cnpj} • {order.city}</p></div><Status status={order.status} /></div>
        <div className="modalSplit">
          <div>
            <h3>Produtos solicitados</h3>
            <div className="modalItems">{order.products.map((p) => <div key={p.name}><span>{p.qty} {p.unit}</span><b>{p.name}</b><strong>{money(p.qty * p.price)}</strong></div>)}</div>
            <div className="noteBox"><b>Observações</b><p>{order.notes}</p></div>
          </div>
          <div className="summaryBox">
            <h3>Resumo</h3>
            <p><b>Origem:</b> {order.source}</p>
            <p><b>WhatsApp:</b> {order.whatsapp}</p>
            <p><b>Entrega:</b> {order.delivery}</p>
            <p><b>Valor:</b> {money(order.value)}</p>
            <div className="stackButtons"><button onClick={() => updateOrderStatus(order.id, 'Separação')}>Enviar para separação</button><button onClick={() => updateOrderStatus(order.id, 'Rota')}>Enviar para rota</button><button onClick={() => createInvoice(order)}>Gerar nota demo</button></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductModal({ product, onClose, notify }) {
  return (
    <div className="modalBackdrop">
      <div className="productModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <img src={product.image} alt={product.name} />
        <div>
          <span className="badge">{product.category}</span>
          <h2>{product.name}</h2>
          <p>Produto controlado no estoque da Saborsan com gestão de validade, temperatura, fornecedor, custo e disponibilidade para pedidos do app.</p>
          <div className="detailGrid"><div><b>Estoque</b><span>{product.stock} {product.unit}</span></div><div><b>Fornecedor</b><span>{product.supplier}</span></div><div><b>Temperatura</b><span>{product.temperature}</span></div><div><b>Preço base</b><span>{money(product.price)}</span></div></div>
          <button className="btnSolid" onClick={() => notify(`Pedido de reposição criado para ${product.name}.`)}>Criar reposição</button>
        </div>
      </div>
    </div>
  )
}

function SupplierModal({ supplier, onClose, notify }) {
  return (
    <div className="modalBackdrop">
      <div className="detailModal small">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader"><div><span>Comunicação com fornecedor</span><h2>{supplier.name}</h2><p>{supplier.contact} • {supplier.phone}</p></div><MessageCircle /></div>
        <textarea defaultValue={`Olá, ${supplier.contact}. Tudo bem? Aqui é da Saborsan. Gostaríamos de consultar disponibilidade e prazo para reposição dos produtos relacionados a ${supplier.type}. Pode nos enviar as condições comerciais atualizadas?`} />
        <div className="stackButtons horizontal"><button onClick={() => notify(`Mensagem demonstrativa enviada para ${supplier.name}.`)}>Enviar mensagem</button><button onClick={() => notify(`Cotação demonstrativa solicitada para ${supplier.name}.`)}>Solicitar cotação</button></div>
      </div>
    </div>
  )
}

function Status({ status }) {
  return <span className={`status ${statusClass(status)}`}>{status}</span>
}
function Suggestion({ icon: Icon, title, text }) {
  return <div className="suggestion"><Icon size={18} /><div><b>{title}</b><span>{text}</span></div><ChevronRight size={16} /></div>
}
function OrderLine({ order }) {
  return <div className="orderLine"><div><b>{order.customer}</b><span>{order.id} • {order.source}</span></div><strong>{money(order.value)}</strong><Status status={order.status} /></div>
}
function MiniTable({ title, data }) {
  return <div className="card miniTable"><div className="cardHeader"><h3>{title}</h3></div>{data.map((row, i) => <div className="miniRow" key={i}>{row.map((cell, j) => <span key={j} className={j === 0 ? 'main' : ''}>{cell}</span>)}</div>)}</div>
}
function ReportCard({ icon: Icon, title, value, text }) {
  return <article className="reportCard"><Icon size={28} /><span>{title}</span><h3>{value}</h3><p>{text}</p></article>
}

function Settings({ notify }) {
  const [form, setForm] = useState({
    empresa: 'Saborsan Distribuidora',
    cnpj: '12.345.678/0001-99',
    email: 'contato@saborsan.com.br',
    telefone: '(49) 3224-0000',
    cidade: 'Lages - SC',
    tempMin: '-20',
    tempMax: '-15',
    estoqueAlerta: '10',
    notifEmail: true,
    notifApp: true,
    notifEstoque: true,
    notifEntregas: true,
    tema: 'claro',
    idioma: 'pt-BR',
    versao: '1.0.0',
    entregadorNome: 'João Carlos',
    entregadorTelefone: '(49) 99811-3302',
    entregadorNotifPedido: true,
    entregadorNotifRota: true,
    relatorioEmail: 'gerencia@saborsan.com.br',
    relatorioFreq: 'mensal',
    relatorioDia: '1',
    relatorioHora: '08:00',
    relatorioVendas: true,
    relatorioEstoque: true,
    relatorioFinanceiro: true,
    relatorioEntregas: false,
    iaLigarModo: 'ia',
    iaLigarDia: 'segunda',
    iaLigarHora: '09:00',
    iaLigarContato: '(49) 99821-4410',
    iaLigarAtivo: true,
  })

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <section className="pageStack">
      <div className="sectionHeader"><div><p>Preferências e dados do sistema</p></div><button className="btnSolid" onClick={() => notify('Configurações salvas com sucesso.')}><CheckCircle2 size={18} /> Salvar alterações</button></div>

      <div className="settingsGrid">
        {/* Dados da empresa */}
        <div className="card settingsCard">
          <div className="cardHeader"><div><p>Identidade</p><h3>Dados da empresa</h3></div><Building2 size={22} /></div>
          <div className="settingsForm">
            <label>Nome da empresa<input value={form.empresa} onChange={(e) => set('empresa', e.target.value)} /></label>
            <label>CNPJ<input value={form.cnpj} onChange={(e) => set('cnpj', e.target.value)} /></label>
            <label>E-mail corporativo<input value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
            <label>Telefone<input value={form.telefone} onChange={(e) => set('telefone', e.target.value)} /></label>
            <label>Cidade / UF<input value={form.cidade} onChange={(e) => set('cidade', e.target.value)} /></label>
          </div>
        </div>

        {/* Estoque */}
        <div className="card settingsCard">
          <div className="cardHeader"><div><p>Operação</p><h3>Estoque e temperatura</h3></div><Boxes size={22} /></div>
          <div className="settingsForm">
            <label>Temperatura mínima (°C)<input type="number" value={form.tempMin} onChange={(e) => set('tempMin', e.target.value)} /></label>
            <label>Temperatura máxima (°C)<input type="number" value={form.tempMax} onChange={(e) => set('tempMax', e.target.value)} /></label>
            <label>Alertar estoque quando abaixo de (%)<input type="number" value={form.estoqueAlerta} onChange={(e) => set('estoqueAlerta', e.target.value)} /></label>
          </div>
        </div>

        {/* Notificações */}
        <div className="card settingsCard">
          <div className="cardHeader"><div><p>Alertas</p><h3>Notificações</h3></div><Bell size={22} /></div>
          <div className="settingsToggles">
            {[
              ['notifEmail', 'Notificações por e-mail'],
              ['notifApp', 'Notificações no painel'],
              ['notifEstoque', 'Alertas de estoque crítico'],
              ['notifEntregas', 'Atualizações de entregas'],
            ].map(([key, label]) => (
              <div className="settingsToggleRow" key={key}>
                <span>{label}</span>
                <label className="switch">
                  <input type="checkbox" checked={form[key]} onChange={() => set(key, !form[key])} />
                  <span></span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Aparência */}
        <div className="card settingsCard">
          <div className="cardHeader"><div><p>Interface</p><h3>Aparência e sistema</h3></div><Settings2 size={22} /></div>
          <div className="settingsForm">
            <label>Tema
              <select value={form.tema} onChange={(e) => set('tema', e.target.value)}>
                <option value="claro">Claro</option>
                <option value="escuro">Escuro (em breve)</option>
              </select>
            </label>
            <label>Idioma
              <select value={form.idioma} onChange={(e) => set('idioma', e.target.value)}>
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en">English (em breve)</option>
              </select>
            </label>
          </div>
          <div className="settingsVersion"><ShieldCheck size={15} /><span>Versão {form.versao} • Sistema estável</span></div>
        </div>

        {/* Entregador */}
        <div className="card settingsCard">
          <div className="cardHeader"><div><p>Logística</p><h3>Contato do entregador</h3></div><Truck size={22} /></div>
          <div className="settingsForm">
            <label>Nome do entregador<input value={form.entregadorNome} onChange={(e) => set('entregadorNome', e.target.value)} /></label>
            <label>WhatsApp / Telefone<input value={form.entregadorTelefone} onChange={(e) => set('entregadorTelefone', e.target.value)} /></label>
          </div>
          <div className="settingsToggles" style={{marginTop: '12px'}}>
            <div className="settingsToggleRow">
              <span>Notificar ao receber pedido</span>
              <label className="switch"><input type="checkbox" checked={form.entregadorNotifPedido} onChange={() => set('entregadorNotifPedido', !form.entregadorNotifPedido)} /><span></span></label>
            </div>
            <div className="settingsToggleRow">
              <span>Notificar ao entrar em rota</span>
              <label className="switch"><input type="checkbox" checked={form.entregadorNotifRota} onChange={() => set('entregadorNotifRota', !form.entregadorNotifRota)} /><span></span></label>
            </div>
          </div>
          <div className="settingsInfo"><Smartphone size={14} /><span>As notificações são enviadas via WhatsApp com os dados do pedido automaticamente.</span></div>
        </div>

        {/* Relatório por e-mail */}
        <div className="card settingsCard">
          <div className="cardHeader"><div><p>Relatórios</p><h3>Envio por e-mail</h3></div><BarChart3 size={22} /></div>
          <div className="settingsForm">
            <label>E-mail de destino<input type="email" value={form.relatorioEmail} onChange={(e) => set('relatorioEmail', e.target.value)} /></label>
            <label>Frequência de envio
              <select value={form.relatorioFreq} onChange={(e) => set('relatorioFreq', e.target.value)}>
                <option value="diario">Diário</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
              </select>
            </label>
            <div className="settingsTwoCols">
              <label>Dia do envio
                <select value={form.relatorioDia} onChange={(e) => set('relatorioDia', e.target.value)}>
                  {Array.from({length: 28}, (_, i) => <option key={i+1} value={String(i+1)}>Dia {i+1}</option>)}
                </select>
              </label>
              <label>Horário<input type="time" value={form.relatorioHora} onChange={(e) => set('relatorioHora', e.target.value)} /></label>
            </div>
          </div>
          <div className="settingsToggles" style={{marginTop:'12px'}}>
            <p className="settingsSub">Incluir no relatório:</p>
            {[['relatorioVendas','Resumo de vendas'],['relatorioEstoque','Movimentação de estoque'],['relatorioFinanceiro','Visão financeira'],['relatorioEntregas','Desempenho de entregas']].map(([key, label]) => (
              <div className="settingsToggleRow" key={key}>
                <span>{label}</span>
                <label className="switch"><input type="checkbox" checked={form[key]} onChange={() => set(key, !form[key])} /><span></span></label>
              </div>
            ))}
          </div>
        </div>

        {/* IA — Ligação de estoque */}
        <div className="card settingsCard settingsCardFull">
          <div className="cardHeader"><div><p>Inteligência artificial</p><h3>Ligação automática de alerta de estoque</h3></div><Bot size={22} /></div>
          <div className="settingsToggleRow" style={{marginBottom:'16px'}}>
            <span>Ativar ligação automática da IA</span>
            <label className="switch"><input type="checkbox" checked={form.iaLigarAtivo} onChange={() => set('iaLigarAtivo', !form.iaLigarAtivo)} /><span></span></label>
          </div>
          {form.iaLigarAtivo && (
            <>
              <div className="settingsForm">
                <label>Número a ser contatado (WhatsApp / telefone)<input value={form.iaLigarContato} onChange={(e) => set('iaLigarContato', e.target.value)} /></label>
              </div>
              <div className="iaModeSelector">
                <button className={`iaModeBtn${form.iaLigarModo === 'ia' ? ' active' : ''}`} onClick={() => set('iaLigarModo', 'ia')}>
                  <Sparkles size={18} />
                  <div><b>Modo inteligente</b><small>A IA liga assim que detectar que o estoque está chegando ao limite crítico, sem horário fixo.</small></div>
                </button>
                <button className={`iaModeBtn${form.iaLigarModo === 'agendado' ? ' active' : ''}`} onClick={() => set('iaLigarModo', 'agendado')}>
                  <CalendarDays size={18} />
                  <div><b>Horário fixo</b><small>A IA liga em um dia e horário específico para verificar o estoque e alertar se necessário.</small></div>
                </button>
              </div>
              {form.iaLigarModo === 'agendado' && (
                <div className="settingsForm settingsTwoCols" style={{marginTop:'14px'}}>
                  <label>Dia da semana
                    <select value={form.iaLigarDia} onChange={(e) => set('iaLigarDia', e.target.value)}>
                      {['segunda','terça','quarta','quinta','sexta','sábado'].map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}-feira</option>)}
                    </select>
                  </label>
                  <label>Horário<input type="time" value={form.iaLigarHora} onChange={(e) => set('iaLigarHora', e.target.value)} /></label>
                </div>
              )}
              <div className="settingsInfo" style={{marginTop:'14px'}}>
                <Bot size={14} />
                <span>{form.iaLigarModo === 'ia'
                  ? 'A IA monitora o estoque em tempo real e aciona o contato assim que identificar risco de falta de produto.'
                  : `A IA ligará toda ${form.iaLigarDia}-feira às ${form.iaLigarHora} para verificar o estoque e alertar o contato configurado.`}
                </span>
              </div>
            </>
          )}
        </div>

      </div>
    </section>
  )
}

function Sellers() {
  const [selected, setSelected] = useState(null)
  const seller = selected ? sellers.find((s) => s.id === selected) : null
  const totalGeral = sellers.reduce((a, s) => a + s.total, 0)

  return (
    <section className="pageStack">
      <div className="sectionHeader"><div><p>Vendas realizadas pelo app</p></div><button className="btnSolid"><UserRound size={18} /> Novo vendedor</button></div>

      <div className="sellersSummary">
        <div className="card sellerStat"><span>Total de vendas</span><strong>{money(totalGeral)}</strong><small>{sellers.reduce((a, s) => a + s.sales.length, 0)} pedidos no período</small></div>
        <div className="card sellerStat"><span>Vendedores ativos</span><strong>{sellers.filter(s => s.status === 'Ativo').length}</strong><small>de {sellers.length} cadastrados</small></div>
        <div className="card sellerStat"><span>Melhor vendedor</span><strong>{sellers.reduce((a, b) => a.total > b.total ? a : b).name.split(' ')[0]}</strong><small>{money(Math.max(...sellers.map(s => s.total)))}</small></div>
      </div>

      <div className="sellersGrid">
        {sellers.map((s) => {
          const pct = Math.min(100, Math.round((s.total / s.meta) * 100))
          return (
            <article className={`sellerCard${selected === s.id ? ' sellerActive' : ''}`} key={s.id} onClick={() => setSelected(selected === s.id ? null : s.id)}>
              <div className="sellerTop">
                <div className="avatar">{s.avatar}</div>
                <div><h3>{s.name}</h3><p>{s.region}</p></div>
                <Status status={s.status} />
              </div>
              <div className="sellerMeta">
                <div className="stockLevel"><div style={{ width: `${pct}%` }}></div></div>
                <div className="stockMeta"><b>{money(s.total)}</b><small>Meta: {money(s.meta)} • {pct}%</small></div>
              </div>
              <div className="sellerFooter"><span>{s.sales.length} vendas</span><small>{s.phone}</small></div>
            </article>
          )
        })}
      </div>

      {seller && (
        <div className="card sellerDetail">
          <div className="cardHeader">
            <div><p>Vendas do vendedor</p><h3>{seller.name}</h3></div>
            <button onClick={() => setSelected(null)}><X size={18} /></button>
          </div>
          <div className="sellerSalesList">
            <div className="sellerSalesHeader"><b>Pedido</b><b>Cliente</b><b>Produtos</b><b>Pagamento</b><b>Data</b><b>Valor</b></div>
            {seller.sales.map((sale) => (
              <div key={sale.id}>
                <b>{sale.id}</b>
                <span>{sale.customer}<small>{sale.city}</small></span>
                <span>{sale.products.map(p => `${p.name} ×${p.qty}`).join(', ')}</span>
                <span>{sale.payment}</span>
                <small>{sale.date}</small>
                <strong>{money(sale.value)}</strong>
              </div>
            ))}
          </div>
          <div className="sellerDetailTotal"><span>Total do período</span><strong>{money(seller.total)}</strong></div>
        </div>
      )}
    </section>
  )
}

const ncmMap = {
  'Pão de Queijo Tradicional': { ncm: '19059090', cfop: '5102' },
  'Mini Pizza Congelada':      { ncm: '19012000', cfop: '5102' },
  'Açaí Premium Balde':        { ncm: '20089200', cfop: '5102' },
  'Croissant Folhado':         { ncm: '19059090', cfop: '5102' },
  'Mix de Salgados':           { ncm: '21069090', cfop: '5102' },
  'Polpas de Frutas Sortidas': { ncm: '20089900', cfop: '5102' },
}

const STEPS = ['previa', 'validacao', 'enviando', 'autorizada', 'cliente']

function NotaFiscalModal({ order, onClose, updateOrderStatus, notify }) {
  const [step, setStep] = useState('previa')
  const [enviandoStep, setEnviandoStep] = useState(0)

  const nfNum = '000' + (Math.floor(Math.random() * 900) + 100)
  const chave = '4226 0600 0000 0000 0000 5500 1000 0001 2310 0001 ' + nfNum

  const stepIndex = STEPS.indexOf(step)

  const startEnvio = () => {
    setStep('enviando')
    setEnviandoStep(0)
    const steps = [200, 900, 1800, 2800]
    steps.forEach((delay, i) => setTimeout(() => setEnviandoStep(i + 1), delay))
    setTimeout(() => setStep('autorizada'), 3400)
  }

  const finalizar = () => {
    updateOrderStatus(order.id, 'Nota emitida')
    notify(`NF-e ${nfNum} autorizada e enviada para ${order.customer}.`)
    onClose()
  }

  const totalImpostos = (order.value * 0.12).toFixed(2)
  const totalNota = (order.value * 1.12).toFixed(2)

  const downloadXML = () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${chave.replace(/\s/g,'')}" versao="4.00">
      <ide>
        <cUF>42</cUF><cNF>${nfNum}</cNF><natOp>Venda de mercadoria</natOp>
        <mod>55</mod><serie>1</serie><nNF>${nfNum}</nNF>
        <dhEmi>${new Date().toISOString()}</dhEmi><tpNF>1</tpNF>
        <idDest>1</idDest><cMunFG>4209300</cMunFG><tpImp>1</tpImp>
        <tpEmis>1</tpEmis><tpAmb>2</tpAmb><finNFe>1</finNFe>
        <indFinal>0</indFinal><indPres>0</indPres><procEmi>0</procEmi><verProc>1.0.0</verProc>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Saborsan Distribuidora LTDA</xNome>
        <enderEmit>
          <xLgr>Rua das Acácias</xLgr><nro>100</nro>
          <xBairro>Centro</xBairro><cMun>4209300</cMun>
          <xMun>Lages</xMun><UF>SC</UF><CEP>88501000</CEP><cPais>1058</cPais><xPais>Brasil</xPais>
        </enderEmit>
        <IE>123456789</IE><CRT>3</CRT>
      </emit>
      <dest>
        <CNPJ>${order.cnpj.replace(/\D/g,'')}</CNPJ>
        <xNome>${order.customer}</xNome>
        <indIEDest>1</indIEDest>
      </dest>
      ${order.products.map((p, i) => {
        const info = ncmMap[p.name] || { ncm: '21069090', cfop: '5102' }
        return `<det nItem="${i+1}">
        <prod>
          <cProd>00${i+1}</cProd><cEAN>SEM GTIN</cEAN>
          <xProd>${p.name}</xProd><NCM>${info.ncm}</NCM>
          <CFOP>${info.cfop}</CFOP><uCom>${p.unit}</uCom>
          <qCom>${p.qty}</qCom><vUnCom>${p.price.toFixed(2)}</vUnCom>
          <vProd>${(p.qty * p.price).toFixed(2)}</vProd>
          <cEANTrib>SEM GTIN</cEANTrib><uTrib>${p.unit}</uTrib>
          <qTrib>${p.qty}</qTrib><vUnTrib>${p.price.toFixed(2)}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>${(p.qty*p.price).toFixed(2)}</vBC><pICMS>12.00</pICMS><vICMS>${(p.qty*p.price*0.12).toFixed(2)}</vICMS></ICMS00></ICMS></imposto>
      </det>`}).join('\n')}
      <total>
        <ICMSTot>
          <vBC>${order.value.toFixed(2)}</vBC><vICMS>${totalImpostos}</vICMS>
          <vProd>${order.value.toFixed(2)}</vProd><vNF>${totalNota}</vNF>
        </ICMSTot>
      </total>
      <transp><modFrete>0</modFrete></transp>
      <cobr><dup><nDup>001</nDup><dVenc>${new Date(Date.now()+30*86400000).toISOString().slice(0,10)}</dVenc><vDup>${totalNota}</vDup></dup></cobr>
      <infAdic><infCpl>NF-e emitida em carater de demonstracao. Pedido: ${order.id}</infCpl></infAdic>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>2</tpAmb><verAplic>SP_NFE_PL_008i2</verAplic>
      <chNFe>${chave.replace(/\s/g,'')}</chNFe>
      <dhRecbto>${new Date().toISOString()}</dhRecbto>
      <nProt>1${nfNum}00000001</nProt><digVal>DEMO=</digVal><cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `NFe_${nfNum}.xml`; a.click()
    URL.revokeObjectURL(url)
  }

  const downloadDANFE = () => {
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>DANFE - NF-e ${nfNum}</title>
<style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#222}h1{font-size:14px;text-align:center;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{border:1px solid #999;padding:4px 6px}th{background:#eee;text-align:left}.header{display:flex;justify-content:space-between;align-items:flex-start;border:1px solid #999;padding:10px;margin-bottom:10px}.badge{border:2px solid #000;padding:4px 10px;font-weight:bold;font-size:13px}.section{border:1px solid #999;padding:8px;margin-bottom:8px}.label{font-weight:bold;font-size:10px;text-transform:uppercase;color:#555}</style>
</head><body>
<div class="header">
  <div><div class="label">Emitente</div><b>Saborsan Distribuidora LTDA</b><br>CNPJ: 12.345.678/0001-99<br>Rua das Acácias, 100 — Lages/SC</div>
  <div style="text-align:center"><div class="badge">NF-e</div><br><b>N° ${nfNum} Série 1</b><br><small>Folha 1/1</small></div>
  <div style="text-align:right"><div class="label">Chave de Acesso</div><small>${chave}</small><br><br><div class="label">Data de Emissão</div>${new Date().toLocaleDateString('pt-BR')}</div>
</div>
<div class="section"><div class="label">Destinatário</div><b>${order.customer}</b> — CNPJ: ${order.cnpj} — ${order.city}</div>
<table><thead><tr><th>Produto</th><th>NCM</th><th>CFOP</th><th>Qtd</th><th>Vl Unit</th><th>Vl Total</th></tr></thead><tbody>
${order.products.map(p=>{ const info=ncmMap[p.name]||{ncm:'21069090',cfop:'5102'}; return `<tr><td>${p.name}</td><td>${info.ncm}</td><td>${info.cfop}</td><td>${p.qty} ${p.unit}</td><td>R$ ${p.price.toFixed(2)}</td><td>R$ ${(p.qty*p.price).toFixed(2)}</td></tr>` }).join('')}
</tbody></table>
<table><tr><th>Total Produtos</th><th>Impostos (12%)</th><th>Total NF-e</th></tr>
<tr><td>R$ ${order.value.toFixed(2)}</td><td>R$ ${totalImpostos}</td><td><b>R$ ${totalNota}</b></td></tr></table>
<div class="section"><div class="label">Informações Adicionais</div>NF-e emitida em caráter de demonstração. Pedido de origem: ${order.id}. Autorizado o uso da NF-e.</div>
</body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `DANFE_${nfNum}.html`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="nfOverlay" onClick={(e) => e.target.classList.contains('nfOverlay') && onClose()}>
      <div className="nfModal">

        {/* Stepper */}
        <div className="nfStepper">
          {[['Prévia', 'previa'], ['Validação', 'validacao'], ['Enviando', 'enviando'], ['Autorizada', 'autorizada'], ['Enviar cliente', 'cliente']].map(([label, id], i) => (
            <div key={id} className={`nfStep${STEPS.indexOf(id) <= stepIndex ? ' done' : ''}${step === id ? ' active' : ''}`}>
              <div className="nfStepDot">{STEPS.indexOf(id) < stepIndex ? <CheckCircle2 size={14} /> : i + 1}</div>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* STEP 1 - Prévia */}
        {step === 'previa' && (
          <div className="nfBody">
            <button className="nfClose" onClick={onClose}><X size={18} /></button>
            <div className="nfSection">
              <span className="topKicker">Prévia da NF-e</span>
              <h2>{order.customer}</h2>
              <p>{order.city} • CNPJ: {order.cnpj}</p>
            </div>
            <div className="nfGrid">
              <div className="nfCard">
                <p className="nfLabel">Emitente</p>
                <b>Saborsan Distribuidora LTDA</b>
                <small>CNPJ: 12.345.678/0001-99</small>
              </div>
              <div className="nfCard">
                <p className="nfLabel">Destinatário</p>
                <b>{order.customer}</b>
                <small>CNPJ: {order.cnpj}</small>
              </div>
              <div className="nfCard">
                <p className="nfLabel">Operação</p>
                <b>Venda de mercadoria</b>
                <small>Saída — CFOP 5102</small>
              </div>
              <div className="nfCard">
                <p className="nfLabel">Pedido de origem</p>
                <b>{order.id}</b>
                <small>{order.delivery}</small>
              </div>
            </div>
            <div className="nfTable">
              <div className="nfTableHead"><span>Produto</span><span>NCM</span><span>CFOP</span><span>Qtd</span><span>Valor</span></div>
              {order.products.map((p) => {
                const info = ncmMap[p.name] || { ncm: '21069090', cfop: '5102' }
                return (
                  <div className="nfTableRow" key={p.name}>
                    <span>{p.name}</span>
                    <span>{info.ncm}</span>
                    <span>{info.cfop}</span>
                    <span>{p.qty} {p.unit}</span>
                    <span>{money(p.qty * p.price)}</span>
                  </div>
                )
              })}
              <div className="nfTableFoot">
                <span>Subtotal</span><span>{money(order.value)}</span>
              </div>
              <div className="nfTableFoot">
                <span>Impostos estimados (12%)</span><span>{money(parseFloat(totalImpostos))}</span>
              </div>
              <div className="nfTableFoot total">
                <span>Total da nota</span><span>{money(parseFloat(totalNota))}</span>
              </div>
            </div>
            <div className="nfAI">
              <div className="nfAIHeader"><Sparkles size={16} /><b>IA Fiscal</b></div>
              <div className="nfAIItem success"><CheckCircle2 size={14} /> Cliente com CNPJ válido</div>
              <div className="nfAIItem success"><CheckCircle2 size={14} /> Produtos com NCM preenchido</div>
              <div className="nfAIItem success"><CheckCircle2 size={14} /> CFOP compatível com venda interna</div>
              <div className="nfAIItem warning"><AlertTriangle size={14} /> Verifique se há substituição tributária nos produtos congelados</div>
            </div>
            <div className="nfActions">
              <button className="nfBtnGhost" onClick={onClose}>Cancelar</button>
              <button className="btnSolid" onClick={() => setStep('validacao')}>Validar nota</button>
            </div>
          </div>
        )}

        {/* STEP 2 - Validação */}
        {step === 'validacao' && (
          <div className="nfBody">
            <button className="nfClose" onClick={onClose}><X size={18} /></button>
            <span className="topKicker">Validação fiscal</span>
            <h2>Verificação antes do envio</h2>
            <p>Todos os dados foram conferidos automaticamente antes de enviar para a SEFAZ.</p>
            <div className="nfChecklist">
              {['Dados do cliente', 'Dados da empresa', 'Produtos e quantidades', 'NCM dos produtos', 'CFOP da operação', 'Cálculo de impostos', 'Totais da nota', 'Certificado digital', 'XML gerado corretamente'].map((item) => (
                <div className="nfCheckItem" key={item}><CheckCircle2 size={16} /><span>{item}</span></div>
              ))}
            </div>
            <div className="nfStatusBadge"><ShieldCheck size={18} /> Pronto para envio à SEFAZ</div>
            <div className="nfActions">
              <button className="nfBtnGhost" onClick={() => setStep('previa')}>Editar dados</button>
              <button className="btnSolid" onClick={startEnvio}>Enviar para SEFAZ</button>
            </div>
          </div>
        )}

        {/* STEP 3 - Enviando */}
        {step === 'enviando' && (
          <div className="nfBody nfCentered">
            <div className="nfSending">
              <div className="nfSpinner" />
              <h2>Enviando NF-e para SEFAZ...</h2>
              <div className="nfSendingSteps">
                {['Gerando XML...', 'Assinando com certificado digital...', 'Enviando para SEFAZ...', 'Aguardando autorização...'].map((label, i) => (
                  <div key={i} className={`nfSendStep${enviandoStep > i ? ' done' : ''}${enviandoStep === i ? ' current' : ''}`}>
                    {enviandoStep > i ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4 - Autorizada */}
        {step === 'autorizada' && (
          <div className="nfBody nfCentered">
            <div className="nfSuccess">
              <div className="nfSuccessIcon"><CheckCircle2 size={44} /></div>
              <h2>NF-e autorizada com sucesso!</h2>
              <p>A nota fiscal foi processada e autorizada pela SEFAZ.</p>
              <div className="nfAutorizadaGrid">
                <div><small>Número da nota</small><b>{nfNum}</b></div>
                <div><small>Série</small><b>1</b></div>
                <div className="span2"><small>Chave de acesso</small><b className="mono">{chave}</b></div>
              </div>
              <div className="nfDocButtons">
                <button className="nfDocBtn" onClick={downloadXML}>Baixar XML</button>
                <button className="nfDocBtn" onClick={downloadDANFE}>Baixar DANFE</button>
              </div>
              <div className="nfStatusBadge success">Pedido atualizado para: Nota emitida — próxima etapa: separar para entrega</div>
            </div>
            <div className="nfActions">
              <button className="nfBtnGhost" onClick={finalizar}>Fechar</button>
              <button className="btnSolid" onClick={() => setStep('cliente')}>Enviar para cliente</button>
            </div>
          </div>
        )}

        {/* STEP 5 - Enviar para cliente */}
        {step === 'cliente' && (
          <div className="nfBody">
            <button className="nfClose" onClick={onClose}><X size={18} /></button>
            <span className="topKicker">Envio ao cliente</span>
            <h2>Enviar documentos</h2>
            <p>Selecione como deseja enviar a nota para <b>{order.customer}</b>.</p>
            <div className="nfClienteInfo">
              <div className="nfCard"><p className="nfLabel">E-mail</p><b>financeiro@{order.customer.toLowerCase().replace(/\s+/g, '')}.com.br</b></div>
              <div className="nfCard"><p className="nfLabel">WhatsApp</p><b>{order.whatsapp}</b></div>
            </div>
            <div className="nfAnexos">
              <div className="nfAnexoItem"><CheckCircle2 size={15} /><span>DANFE em PDF</span></div>
              <div className="nfAnexoItem"><CheckCircle2 size={15} /><span>XML da NF-e</span></div>
            </div>
            <div className="nfMensagem">
              <p className="nfLabel">Mensagem</p>
              <textarea defaultValue={`Olá, segue a nota fiscal referente ao seu pedido ${order.id}. Em caso de dúvidas, entre em contato conosco.\n\nAtenciosamente,\nSaborsan Distribuidora`} />
            </div>
            <div className="nfActions">
              <button className="nfBtnGhost" onClick={() => setStep('autorizada')}>Voltar</button>
              <button className="btnSolid" onClick={finalizar}>Enviar agora</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function SupplierTranscriptModal({ supplier, onClose }) {
  const transcript = supplierTranscripts[supplier.id]
  return (
    <div className="nfOverlay" onClick={(e) => e.target.classList.contains('nfOverlay') && onClose()}>
      <div className="transcriptModal">
        <div className="transcriptHeader">
          <div className="transcriptHeaderInfo">
            <div className="supplierIcon small"><Factory size={16} /></div>
            <div>
              <h3>{supplier.name}</h3>
              <p>{supplier.type} • {transcript.date}</p>
            </div>
          </div>
          <div className="transcriptHeaderRight">
            <span className={`transcriptStatus ${transcript.status === 'Pendente retorno' ? 'warning' : 'success'}`}>
              {transcript.status === 'Pendente retorno' ? <Clock3 size={13} /> : <CheckCircle2 size={13} />}
              {transcript.status}
            </span>
            <button className="nfClose" style={{position:'static'}} onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="transcriptBody">
          <div className="transcriptInfo">
            <Bot size={14} /><span>Conversa conduzida pela IA da Saborsan com <b>{supplier.contact}</b> ({supplier.phone})</span>
          </div>
          <div className="transcriptMessages">
            {transcript.messages.map((msg, i) => (
              <div key={i} className={`transcriptMsg ${msg.from === 'ia' ? 'ia' : 'supplier'}`}>
                <div className="transcriptMsgAvatar">
                  {msg.from === 'ia' ? <Bot size={15} /> : supplier.name[0]}
                </div>
                <div className="transcriptMsgContent">
                  <div className="transcriptMsgMeta">
                    <b>{msg.from === 'ia' ? 'IA Saborsan' : supplier.contact}</b>
                    <small>{msg.time}</small>
                  </div>
                  <p>{msg.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="transcriptFooter">
          <div className="transcriptFooterInfo">
            <Smartphone size={14} />
            <span>Contato do fornecedor: <b>{supplier.phone}</b></span>
          </div>
          <div style={{display:'flex', gap:'10px'}}>
            <button className="nfBtnGhost" onClick={onClose}>Fechar</button>
            <a className="btnSolid transcriptCallBtn" href={`tel:${supplier.phone.replace(/\D/g,'')}`}>
              <Smartphone size={15} /> Ligar agora
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
