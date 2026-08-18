import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  FileDown,
  ExternalLink,
  Ban,
  UploadCloud,
  FileText as FileTextIcon,
  ClipboardEdit,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Loader2,
  Package,
  Info,
  RefreshCw,
  Tag,
  Wand2,
  Database,
  ImageOff,
  Printer,
} from 'lucide-react'
import './styles.css'

const BASE = import.meta.env.BASE_URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7071'
const money = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const products = [
  { id: 1, name: 'Pão de Queijo Tradicional', category: 'Pão de queijo', image: BASE + 'images/pao-de-queijo-real.jpg', stock: 142, min: 60, price: 128.9, supplier: 'Queijos Serra Alta', temperature: '-18°C', unit: 'cx 5kg' },
  { id: 2, name: 'Mini Pizza Congelada', category: 'Assados', image: BASE + 'images/mini-pizza-1.jpg', stock: 88, min: 55, price: 96.5, supplier: 'Forno Sul Alimentos', temperature: '-18°C', unit: 'cx 30 un' },
  { id: 3, name: 'Açaí Premium Balde', category: 'Açaí', image: BASE + 'images/acai-real.avif', stock: 31, min: 40, price: 154.9, supplier: 'Amazônia Mix', temperature: '-18°C', unit: 'balde 10L' },
  { id: 4, name: 'Croissant Folhado', category: 'Croissant', image: BASE + 'images/croissant-real.avif', stock: 67, min: 35, price: 112.0, supplier: 'La Maison Congelados', temperature: '-18°C', unit: 'cx 40 un' },
  { id: 5, name: 'Mix de Salgados', category: 'Salgados', image: BASE + 'images/salgados-real.jpg', stock: 54, min: 50, price: 89.7, supplier: 'Salgados San Pietro', temperature: '-18°C', unit: 'cx 100 un' },
  { id: 6, name: 'Polpas de Frutas Sortidas', category: 'Polpas', image: BASE + 'images/linha-mercados-real.png', stock: 210, min: 120, price: 48.5, supplier: 'Frutas do Vale', temperature: '-18°C', unit: 'pct 20 un' },
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

const initialPayments = [
  {
    id: 'PAG-001',
    clientName: 'Padaria Bela Vista',
    orderId: 'PED-2049',
    sellerName: 'Carlos Oliveira',
    paymentDate: '11/08/2025',
    paymentMethod: 'PIX',
    paymentValue: 1984.60,
    totalPaid: 1984.60,
    status: 'Pago',
  },
  {
    id: 'PAG-002',
    clientName: 'Café Avenida',
    orderId: 'PED-2048',
    sellerName: 'Carlos Oliveira',
    paymentDate: '10/08/2025',
    paymentMethod: 'Cartão de débito',
    paymentValue: 1297.20,
    totalPaid: 1297.20,
    status: 'Pago',
  },
  {
    id: 'PAG-003',
    clientName: 'Mercado Santa Clara',
    orderId: 'PED-2047',
    sellerName: 'Ana Paula Ramos',
    paymentDate: '11/08/2025',
    paymentMethod: 'Boleto',
    paymentValue: 2880.30,
    totalPaid: 0,
    status: 'Pendente',
  },
  {
    id: 'PAG-004',
    clientName: 'Restaurante Dom Sabor',
    orderId: 'PED-2046',
    sellerName: 'Ana Paula Ramos',
    paymentDate: '09/08/2025',
    paymentMethod: 'PIX',
    paymentValue: 953.80,
    totalPaid: 953.80,
    status: 'Pago',
  },
  {
    id: 'PAG-005',
    clientName: 'Padaria Serrana',
    orderId: 'PED-2044',
    sellerName: 'Rafael Menezes',
    paymentDate: '07/08/2025',
    paymentMethod: 'Boleto',
    paymentValue: 1780.00,
    totalPaid: 890.00,
    status: 'Parcial',
  },
  {
    id: 'PAG-006',
    clientName: 'Conveniência Central',
    orderId: 'PED-2040',
    sellerName: 'Rafael Menezes',
    paymentDate: '02/08/2025',
    paymentMethod: 'Cartão de crédito',
    paymentValue: 620.00,
    totalPaid: 0,
    status: 'Atrasado',
  },
]

const suppliers = [
  { id: 1, name: 'Queijos Serra Alta', type: 'Laticínios e massas', contact: 'Marcos', phone: '(49) 99910-1111', status: 'Ativo', lead: '2 dias', contactNumber: 9654564 },
  { id: 2, name: 'Forno Sul Alimentos', type: 'Assados e pizzas', contact: 'Carolina', phone: '(48) 99122-4400', status: 'Ativo', lead: '3 dias', contactNumber: 9154564 },
  { id: 3, name: 'Amazônia Mix', type: 'Açaí e sobremesas', contact: 'Rafael', phone: '(47) 99700-2211', status: 'Atenção', lead: '5 dias', contactNumber: 844565465 },
  { id: 4, name: 'Frutas do Vale', type: 'Polpas e frutas', contact: 'Fernanda', phone: '(49) 99870-4451', status: 'Ativo', lead: '2 dias', contactNumber: 984564654 },
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
  { id: 'pagamentos', label: 'Pagamentos', icon: CreditCard },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  { id: 'automacao', label: 'Automação', icon: Bot },
  { id: 'configuracoes', label: 'Configurações', icon: Settings2 },
]

const statusClass = (status) => {
  const s = status.toLowerCase()
  if (s.includes('recebido') || s.includes('aguardando') || s.includes('preparo') || s.includes('pendente')) return 'warning'
  if (s.includes('separação') || s.includes('rota') || s.includes('carregando') || s.includes('parcial')) return 'info'
  if (s.includes('entregue') || s.includes('emitida') || s.includes('ativo') || s.includes('vip') || s.includes('pronto') || s.includes('pago')) return 'success'
  if (s.includes('inativo') || s.includes('atenção') || s.includes('reativar') || s.includes('baixo') || s.includes('erro') || s.includes('rejeitad') || s.includes('atrasado') || s.includes('cancelado') || s.includes('removido')) return 'danger'
  return 'neutral'
}

function NotifPanel({ notifications, onDismiss, onClearAll, onClose }) {
  return (
    <>
      <div className="notifOverlay" onClick={onClose} />
      <aside className="notifPanel">
        <div className="notifHeader">
          <h3>Notificações</h3>
          {notifications.length > 0 && <span className="badge navy">{notifications.length} nova{notifications.length !== 1 ? 's' : ''}</span>}
          <button className="notifClose" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="notifList">
          {notifications.length === 0 && (
            <p style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', fontWeight: 700 }}>Nenhuma notificação no momento.</p>
          )}
          {notifications.map(({ id, icon: Icon, title, text, time, type }) => (
            <div className={`notifItem${type === 'warning' ? ' notifWarning' : ''}`} key={id}>
              <div className="notifIcon"><Icon size={18} /></div>
              <div className="notifBody">
                <b>{title}</b>
                <p>{text}</p>
              </div>
              <div className="notifItemRight">
                <button className="notifDismiss" onClick={() => onDismiss(id)} aria-label="Remover notificação"><X size={13} /></button>
                <small>{time}</small>
              </div>
            </div>
          ))}
        </div>
        {notifications.length > 0 && (
          <button className="notifFooter" onClick={onClearAll}>Limpar todas</button>
        )}
      </aside>
    </>
  )
}

function App() {
  const [employee, setEmployee] = useState(() => {
    try { const s = localStorage.getItem('saborsan_employee'); return s ? JSON.parse(s) : null } catch { return null }
  })
  const [active, setActive] = useState('dashboard')
  const [aiEnabled, setAiEnabled] = useState(true)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [supplierModal, setSupplierModal] = useState(null)
  const [toast, setToast] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [notaFiscalOrder, setNotaFiscalOrder] = useState(null)
  const [newOrderOpen, setNewOrderOpen] = useState(false)
  const [verNotaOrder, setVerNotaOrder] = useState(null)
  const [removeConfirmOrder, setRemoveConfirmOrder] = useState(null)
  const [reactivateConfirmOrder, setReactivateConfirmOrder] = useState(null)
  const [editOrder, setEditOrder] = useState(null)
  const [removeConfirmProduct, setRemoveConfirmProduct] = useState(null)
  const [editProduct, setEditProduct] = useState(null)
  const [stockRefreshKey, setStockRefreshKey] = useState(0)
  const [topbarSearch, setTopbarSearch] = useState('')
  const [deliveriesState, setDeliveriesState] = useState([])
  const [newDeliveryOpen, setNewDeliveryOpen] = useState(false)
  const [selectedDelivery, setSelectedDelivery] = useState(null)
  const [editDelivery, setEditDelivery] = useState(null)
  const [vehiclesState, setVehiclesState] = useState([])
  const [vehiclesOpen, setVehiclesOpen] = useState(false)
  const [clientsState, setClientsState] = useState([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [newClientOpen, setNewClientOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [editClient, setEditClient] = useState(null)
  const [removeConfirmClient, setRemoveConfirmClient] = useState(null)
  const [paymentsState, setPaymentsState] = useState(initialPayments)
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [newPaymentOpen, setNewPaymentOpen] = useState(false)
  const [apiProductsState, setApiProductsState] = useState([])
  const [bgImport, setBgImport] = useState(null)
  const [bgImportPanelOpen, setBgImportPanelOpen] = useState(false)
  const [receiveOrdersActive, setReceiveOrdersActive] = useState(false)

  const [systemNotifications, setSystemNotifications] = useState([])
  const [notifSettings, setNotifSettings] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('saborsan_settings') || '{}')
      return {
        notifOrders:          s.notifOrders          !== undefined ? s.notifOrders          : true,
        notifSellers:         s.notifSellers         !== undefined ? s.notifSellers         : true,
        notifFiscalDocuments: s.notifFiscalDocuments !== undefined ? s.notifFiscalDocuments : true,
        notifStock:           s.notifStock           !== undefined ? s.notifStock           : true,
        notifSuppliers:       s.notifSuppliers       !== undefined ? s.notifSuppliers       : true,
        notifPurchases:       s.notifPurchases       !== undefined ? s.notifPurchases       : true,
        notifDeliveries:      s.notifDeliveries      !== undefined ? s.notifDeliveries      : true,
        notifClients:         s.notifClients         !== undefined ? s.notifClients         : true,
        notifPayments:        s.notifPayments        !== undefined ? s.notifPayments        : true,
      }
    } catch {
      return { notifOrders: true, notifSellers: true, notifFiscalDocuments: true, notifStock: true, notifSuppliers: true, notifPurchases: true, notifDeliveries: true, notifClients: true, notifPayments: true }
    }
  })
  const notifSettingsRef = useRef(notifSettings)
  useEffect(() => { notifSettingsRef.current = notifSettings }, [notifSettings])
  const addNotif = useCallback((category, { type = 'default', icon, title, text }) => {
    if (!notifSettingsRef.current[category]) return
    setSystemNotifications((prev) => [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category, type, icon, title, text,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }, ...prev])
  }, [])

  const fetchApiProducts = () => {
    fetch(`${API_URL}/api/products`)
      .then((r) => r.json())
      .then((data) => { if (data.products) setApiProductsState(data.products) })
      .catch(() => {})
  }

  const fetchOrders = () => {
    setOrdersLoading(true)
    fetch(`${API_URL}/api/orders`)
      .then((r) => r.json())
      .then((data) => { if (data.orders) setOrders(data.orders) })
      .catch(() => {})
      .finally(() => setOrdersLoading(false))
  }

  const fetchDeliveries = () => {
    fetch(`${API_URL}/api/deliveries`)
      .then((r) => r.json())
      .then((data) => { if (data.deliveries) setDeliveriesState(data.deliveries) })
      .catch(() => {})
  }

  const fetchVehicles = () => {
    fetch(`${API_URL}/api/vehicles`)
      .then((r) => r.json())
      .then((data) => { if (data.vehicles) setVehiclesState(data.vehicles) })
      .catch(() => {})
  }

  const fetchClients = () => {
    setClientsLoading(true)
    fetch(`${API_URL}/api/clients`)
      .then((r) => r.json())
      .then((data) => { if (data.clients) setClientsState(data.clients) })
      .catch(() => {})
      .finally(() => setClientsLoading(false))
  }

  const fetchPayments = () => {
    setPaymentsLoading(true)
    fetch(`${API_URL}/api/payments`)
      .then((r) => r.json())
      .then((data) => {
        if (data.payments) {
          setPaymentsState(data.payments)
          data.payments.filter((p) => p.status === 'Pendente' || p.status === 'Atrasado').forEach((p) => {
            const sessionKey = `notif_pay_pending_${p.id}`
            if (!sessionStorage.getItem(sessionKey)) {
              addNotif('notifPayments', { icon: Clock3, type: 'warning', title: `Pagamento ${p.status.toLowerCase()}`, text: `Pagamento de ${p.clientName} no valor de ${money(p.paymentValue || 0)} está ${p.status.toLowerCase()}.` })
              sessionStorage.setItem(sessionKey, '1')
            }
          })
        }
      })
      .catch(() => {})
      .finally(() => setPaymentsLoading(false))
  }

  useEffect(() => { fetchOrders() }, [])
  useEffect(() => { fetchDeliveries() }, [])
  useEffect(() => {
    fetch(`${API_URL}/api/automation-config?key=receive_orders`)
      .then((r) => r.json())
      .then((data) => { setReceiveOrdersActive(!!(data?.config?.isActive)) })
      .catch((err) => { console.error('Falha ao carregar status da automação:', err) })
  }, [])
  useEffect(() => { fetchVehicles() }, [])
  useEffect(() => { fetchClients() }, [])
  useEffect(() => { fetchPayments() }, [])
  useEffect(() => { fetchApiProducts() }, [stockRefreshKey])
  useEffect(() => { setTopbarSearch('') }, [active])
  useEffect(() => {
    fetch(`${API_URL}/api/notification-settings`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return
        setNotifSettings((prev) => ({
          ...prev,
          notifOrders:          data.notifOrders          ?? prev.notifOrders,
          notifSellers:         data.notifSellers         ?? prev.notifSellers,
          notifFiscalDocuments: data.notifFiscalDocuments ?? prev.notifFiscalDocuments,
          notifStock:           data.notifStock           ?? prev.notifStock,
          notifSuppliers:       data.notifSuppliers       ?? prev.notifSuppliers,
          notifPurchases:       data.notifPurchases       ?? prev.notifPurchases,
          notifDeliveries:      data.notifDeliveries      ?? prev.notifDeliveries,
          notifClients:         data.notifClients         ?? prev.notifClients,
        }))
      })
      .catch(() => {})
  }, [])

  const totals = useMemo(() => {
    const activeOrders = orders.filter((o) => !o.isDeleted)
    const today = activeOrders.filter((o) => o.time !== 'Ontem')
    return {
      revenue: activeOrders.reduce((sum, item) => sum + item.value, 0),
      todayCount: today.length,
      pending: activeOrders.filter((o) => !['Entregue', 'Cancelado'].includes(o.status)).length,
      lowStock: products.filter((p) => p.stock <= p.min).length,
    }
  }, [orders])

  const notify = (message) => {
    setToast(message)
    window.clearTimeout(window.__saborsanToast)
    window.__saborsanToast = window.setTimeout(() => setToast(''), 2600)
  }

  const startBackgroundAnalysis = useCallback((file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['txt', 'csv', 'pdf'].includes(ext)) {
      setBgImport({ status: 'done', fileName: file.name, parsedRows: null, parseError: 'Formato não suportado. Use TXT, CSV ou PDF.' })
      return
    }
    setBgImport({ status: 'analyzing', fileName: file.name, parsedRows: null, parseError: '' })
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const fileContent = e.target.result
        const res = await fetch(`${API_URL}/api/analyze-document`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileContent, fileName: file.name, fileType: ext }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao analisar documento.')
        const rows = data.products?.length ? data.products : null
        const parseErr = !data.products?.length ? 'Nenhum produto identificado no documento.' : ''
        setBgImport((prev) => prev ? { ...prev, status: 'done', parsedRows: rows, parseError: parseErr } : null)
      } catch (err) {
        setBgImport((prev) => prev ? { ...prev, status: 'done', parsedRows: null, parseError: err.message || 'Erro ao analisar documento com IA.' } : null)
      }
    }
    reader.onerror = () => setBgImport((prev) => prev ? { ...prev, status: 'done', parsedRows: null, parseError: 'Erro ao ler o arquivo.' } : null)
    if (ext === 'pdf') reader.readAsDataURL(file)
    else reader.readAsText(file)
  }, [])

  const prevBgStatusRef = useRef(null)
  useEffect(() => {
    const prev = prevBgStatusRef.current
    prevBgStatusRef.current = bgImport?.status ?? null
    if (prev === 'analyzing' && bgImport?.status === 'done') {
      notify('IA concluiu a análise do documento de estoque!')
      addNotif('notifStock', { icon: PackageCheck, title: 'Análise de estoque concluída', text: `A IA terminou de analisar "${bgImport.fileName}". Clique no ícone de estoque para importar.` })
    }
  }, [bgImport?.status])

  const updateOrderStatus = (id, status, extra = {}) => {
    setOrders((items) => items.map((item) => item.id === id ? { ...item, status, ...extra } : item))
    if (selectedOrder?.id === id) setSelectedOrder((old) => ({ ...old, status, ...extra }))
    if (verNotaOrder?.id === id) setVerNotaOrder((old) => ({ ...old, status, ...extra }))

    if (status === 'Rota') {
      const linkedDelivery = deliveriesState.find((d) => d.orderIds?.includes(id))
      setDeliveriesState((prev) => prev.map((d) =>
        d.orderIds?.includes(id) ? { ...d, status: 'Em rota', progress: 60 } : d
      ))
      setSelectedDelivery((d) => d?.orderIds?.includes(id) ? { ...d, status: 'Em rota', progress: 60 } : d)
      addNotif('notifOrders', { icon: Route, title: 'Pedido entrou em rota', text: `Pedido ${id} está em rota de entrega.` })
      if (linkedDelivery) {
        addNotif('notifDeliveries', { icon: Truck, title: 'Entrega em rota', text: `Entrega ${linkedDelivery.id} com ${linkedDelivery.driver} está em rota.` })
      }
    }

    if (status === 'Entregue') {
      addNotif('notifOrders', { icon: PackageCheck, title: 'Pedido entregue', text: `Pedido ${id} foi entregue com sucesso.` })
    }

    if (status === 'Pronto') {
      const linkedDelivery = deliveriesState.find((d) => d.orderIds?.includes(id))
      if (linkedDelivery) {
        const updatedOrders = orders.map((item) => item.id === id ? { ...item, status } : item)
        const allReady = linkedDelivery.orderIds.every((oid) => {
          const o = updatedOrders.find((x) => x.id === oid)
          return o && ['Pronto', 'Rota', 'Em rota', 'Entregue'].includes(o.status)
        })
        if (allReady) {
          setDeliveriesState((prev) => prev.map((d) => d.id === linkedDelivery.id ? { ...d, status: 'Carregando', progress: 25 } : d))
          setSelectedDelivery((d) => d?.id === linkedDelivery.id ? { ...d, status: 'Carregando', progress: 25 } : d)
        }
      }
      addNotif('notifDeliveries', { icon: CheckCircle2, title: 'Pedidos prontos para rota', text: `Os pedidos foram confirmados como prontos. Nota fiscal gerada com sucesso.` })
    }

    notify(`Pedido ${id} atualizado para ${status}.`)
    fetch(`${API_URL}/api/orders`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: id, status }),
    }).catch(() => {})
  }

  const cancelDelivery = (id) => {
    setDeliveriesState((prev) => prev.map((d) => d.id === id ? { ...d, status: 'Cancelada', progress: 0 } : d))
    setSelectedDelivery(null)
    notify(`Entrega ${id} cancelada.`)
    fetch(`${API_URL}/api/deliveries`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId: id, status: 'Cancelada' }),
    }).catch(() => {})
  }

  const removeDelivery = (id) => {
    setDeliveriesState((prev) => prev.filter((d) => d.id !== id))
    setSelectedDelivery(null)
    notify(`Entrega ${id} removida.`)
    fetch(`${API_URL}/api/deliveries`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId: id }),
    }).catch(() => {})
  }

  const reactivateDelivery = (id) => {
    setDeliveriesState((prev) => prev.map((d) => d.id === id ? { ...d, status: 'Planejada' } : d))
    setSelectedDelivery(null)
    notify(`Entrega ${id} reativada.`)
    fetch(`${API_URL}/api/deliveries`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId: id, status: 'Planejada' }),
    }).catch(() => {})
  }

  const createInvoice = (order) => {
    updateOrderStatus(order.id, 'Nota gerada')
    notify(`Nota fiscal demonstrativa gerada para ${order.customer}.`)
  }

  const createOrder = (order) => {
    setOrders((prev) => [order, ...prev])
    setStockRefreshKey((k) => k + 1)
    notify(`Pedido ${order.id} criado com sucesso!`)
    addNotif('notifOrders', { icon: ShoppingCart, title: 'Novo pedido recebido', text: `Pedido ${order.id} de ${order.customer} no valor de ${money(order.value)} aguarda separação.` })
  }

  const openGerarNota = (order) => {
    setNotaFiscalOrder(order)
  }

  const sendNfeToClient = (id) => {
    const sentAt = new Date().toISOString()
    setOrders((items) => items.map((item) => item.id === id ? { ...item, nfeSentAt: sentAt } : item))
    if (verNotaOrder?.id === id) setVerNotaOrder((old) => ({ ...old, nfeSentAt: sentAt }))
    notify('Nota fiscal enviada ao cliente com sucesso.')
    fetch(`${API_URL}/api/orders`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: id, sentToClient: true }),
    }).catch(() => {})
  }

  const removeOrder = async (id) => {
    let softDeleted = false
    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id }),
      })
      if (!res.ok) throw new Error('Falha ao remover pedido')
      const data = await res.json()
      softDeleted = data.softDeleted === true
    } catch (err) {
      notify('Erro ao remover pedido do servidor.')
      return
    }
    if (softDeleted) {
      // Keep in fiscal history — mark as deleted but preserve nfeData
      setOrders((items) => items.map((item) => item.id === id ? { ...item, isDeleted: true, status: 'Removido', products: [] } : item))
    } else {
      setOrders((items) => items.filter((item) => item.id !== id))
    }
    setRemoveConfirmOrder(null)
    setSelectedOrder(null)
    setStockRefreshKey((k) => k + 1)
    notify(`Pedido ${id} removido.`)
  }

  const reactivateOrder = (id) => {
    setOrders((items) => items.map((item) => item.id === id ? { ...item, isDeleted: false, status: 'Recebido' } : item))
    setReactivateConfirmOrder(null)
    setSelectedOrder(null)
    notify(`Pedido ${id} reativado.`)
    fetch(`${API_URL}/api/orders`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: id, reactivate: true }),
    }).catch(() => {})
  }

  const updateOrder = (updatedOrder) => {
    setOrders((items) => items.map((item) => item.id === updatedOrder.id ? updatedOrder : item))
    setStockRefreshKey((k) => k + 1)
    notify(`Pedido ${updatedOrder.id} atualizado com sucesso!`)
  }

  const removeProduct = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id }),
      })
      if (!res.ok) throw new Error('Falha ao remover produto')
    } catch {
      notify('Erro ao remover produto do servidor.')
      return
    }
    setRemoveConfirmProduct(null)
    setSelectedProduct(null)
    setStockRefreshKey((k) => k + 1)
    notify('Produto removido com sucesso.')
  }

  if (!employee) return <Login onLogin={setEmployee} />

  const title = navItems.find((item) => item.id === active)?.label || 'Dashboard'

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brandBox">
          <img src={BASE + 'images/logo-saborsan.png'} alt="Saborsan" />
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
          <div className="userPill"><span>{employee.email[0].toUpperCase()}</span><div><b>{employee.email.split('@')[0]}</b><small>{employee.role}</small></div></div>
          <button className="logout" onClick={() => { localStorage.removeItem('saborsan_employee'); setEmployee(null) }}><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="mainPanel">
        <header className="topbar">
          <div>
            <span className="topKicker">Saborsan Distribuidora</span>
            <h1>{title}</h1>
          </div>
          <div className="searchBox topbarSearch"><Search size={17} /><input placeholder={{ pedidos: 'Buscar pedidos, clientes...', estoque: 'Buscar produtos', notas: 'Buscar notas fiscais...', vendedores: 'Buscar vendedores...', fornecedores: 'Buscar fornecedores...', clientes: 'Buscar clientes...', pagamentos: 'Buscar pagamentos...' }[active] || 'Buscar no painel...'} value={topbarSearch} onChange={(e) => setTopbarSearch(e.target.value)} /></div>
          <div className="topActions">
            {bgImport && (
              <button
                className={`iconButton${bgImport.status === 'done' ? ' bgImportPulse' : ''}`}
                onClick={() => setBgImportPanelOpen(true)}
                title={bgImport.status === 'analyzing' ? 'Análise de estoque em andamento...' : 'Análise de estoque concluída — clique para importar'}
              >
                <PackageCheck size={19} />
              </button>
            )}
            <button className="iconButton" onClick={() => setNotifOpen(!notifOpen)}><Bell size={19} />{systemNotifications.length > 0 && <span>{systemNotifications.length}</span>}</button>
          </div>
        </header>

        <section className="mobileNav">
          {navItems.slice(0, 6).map(({ id, label, icon: Icon }) => (
            <button key={id} className={active === id ? 'active' : ''} onClick={() => setActive(id)}><Icon size={18} /><span>{label}</span></button>
          ))}
        </section>

        {active === 'dashboard' && <Dashboard totals={totals} orders={orders} aiEnabled={aiEnabled} setActive={setActive} />}
        {active === 'pedidos' && <Orders orders={orders} ordersLoading={ordersLoading} onSelect={setSelectedOrder} updateOrderStatus={updateOrderStatus} createInvoice={createInvoice} onGerarNota={openGerarNota} onNewOrder={() => setNewOrderOpen(true)} onVerNota={setVerNotaOrder} search={topbarSearch} receiveOrdersActive={receiveOrdersActive} />}
        {active === 'vendedores' && <Sellers search={topbarSearch} addNotif={addNotif} />}
        {active === 'notas' && <Invoices orders={orders} onGerarNota={openGerarNota} onVerNota={setVerNotaOrder} search={topbarSearch} />}
        {active === 'estoque' && <Stock onProduct={setSelectedProduct} refreshKey={stockRefreshKey} search={topbarSearch} addNotif={addNotif} bgImport={bgImport} onStartBgAnalysis={startBackgroundAnalysis} onClearBgImport={() => setBgImport(null)} />}
        {active === 'fornecedores' && <Suppliers onMessage={setSupplierModal} search={topbarSearch} addNotif={addNotif} />}
        {active === 'compras' && <Purchases notify={notify} addNotif={addNotif} />}
        {active === 'entregas' && <Deliveries deliveries={deliveriesState} onNewDelivery={() => setNewDeliveryOpen(true)} onSelect={(d) => { setSelectedDelivery(d); fetchDeliveries() }} onOpenVehicles={() => setVehiclesOpen(true)} />}
        {active === 'clientes' && <Clients clientsData={clientsState} clientsLoading={clientsLoading} onNewClient={() => setNewClientOpen(true)} onSelectClient={setSelectedClient} search={topbarSearch} />}
        {active === 'pagamentos' && <Payments paymentsData={paymentsState} paymentsLoading={paymentsLoading} onSelectPayment={setSelectedPayment} onNewPayment={() => setNewPaymentOpen(true)} search={topbarSearch} />}
        {active === 'financeiro' && <Finance />}
        {active === 'relatorios' && <Reports />}
        {active === 'automacao' && <Automation aiEnabled={aiEnabled} setAiEnabled={setAiEnabled} notify={notify} receiveOrdersActive={receiveOrdersActive} setReceiveOrdersActive={setReceiveOrdersActive} />}
        {active === 'configuracoes' && <Settings notify={notify} onNotifSettingChange={(key, val) => setNotifSettings((p) => ({ ...p, [key]: val }))} />}
      </main>

      {selectedPayment && <PaymentDetailModal payment={selectedPayment} onClose={() => setSelectedPayment(null)} />}
      {newPaymentOpen && <NewPaymentModal onClose={() => setNewPaymentOpen(false)} onCreated={(p) => { setPaymentsState((prev) => [p, ...prev]); notify(`Pagamento ${p.id} registrado com sucesso!`); addNotif('notifPayments', { icon: CreditCard, title: 'Novo pagamento registrado', text: `Pagamento de ${p.clientName} no valor de ${money(p.paymentValue || 0)} foi registrado.` }); if (p.status === 'Pendente' || p.status === 'Atrasado') addNotif('notifPayments', { icon: Clock3, type: 'warning', title: 'Pagamento pendente', text: `Pagamento de ${p.clientName} está com status ${(p.status || '').toLowerCase()}.` }) }} />}
      {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onRemove={() => setRemoveConfirmProduct(selectedProduct)} onEdit={() => { setEditProduct(selectedProduct); setSelectedProduct(null) }} />}
      {supplierModal && <SupplierModal supplier={supplierModal} onClose={() => setSupplierModal(null)} notify={notify} />}
      {notaFiscalOrder && <NotaFiscalModal order={notaFiscalOrder} onClose={() => setNotaFiscalOrder(null)} updateOrderStatus={updateOrderStatus} notify={notify} addNotif={addNotif} />}
      {verNotaOrder && <VerNotaModal order={verNotaOrder} onClose={() => setVerNotaOrder(null)} onSendToClient={sendNfeToClient} onGerarNota={(o) => { setVerNotaOrder(null); setNotaFiscalOrder(o) }} updateOrderStatus={updateOrderStatus} />}
      {notifOpen && (
        <NotifPanel
          notifications={systemNotifications}
          onDismiss={(id) => setSystemNotifications((prev) => prev.filter((n) => n.id !== id))}
          onClearAll={() => setSystemNotifications([])}
          onClose={() => setNotifOpen(false)}
        />
      )}
      {bgImportPanelOpen && bgImport && (
        <BgImportPanel
          bgImport={bgImport}
          onClose={() => setBgImportPanelOpen(false)}
          onImportDone={(result) => {
            if (result?.isBatch) addNotif('notifStock', { icon: Boxes, title: 'Produtos registrados via upload', text: `${result.count} produto(s) adicionados ao estoque via documento.` })
            setStockRefreshKey((k) => k + 1)
            setBgImport(null)
            setBgImportPanelOpen(false)
          }}
          onClearBgImport={() => { setBgImport(null); setBgImportPanelOpen(false) }}
        />
      )}
      {newDeliveryOpen && <NewDeliveryModal onClose={() => setNewDeliveryOpen(false)} orders={orders} vehicles={vehiclesState} onCreate={(d) => { setDeliveriesState((prev) => [d, ...prev]); notify(`Entrega ${d.id} criada com sucesso! O entregador será notificado sobre os pedidos em separação.`); addNotif('notifDeliveries', { icon: Truck, title: 'Nova entrega criada', text: `Entrega ${d.id} com ${d.driver} foi criada e está planejada.` }) }} />}
      {editDelivery && <NewDeliveryModal onClose={() => setEditDelivery(null)} orders={orders} vehicles={vehiclesState} editDelivery={editDelivery} onUpdate={(d) => { setDeliveriesState((prev) => prev.map((x) => x.id === d.id ? d : x)); setEditDelivery(null); notify(`Entrega ${d.id} atualizada com sucesso!`); if (d.status === 'Concluída') addNotif('notifDeliveries', { icon: CheckCircle2, title: 'Entrega concluída', text: `Entrega ${d.id} com ${d.driver} foi concluída com sucesso.` }); else if (d.status === 'Em rota') addNotif('notifDeliveries', { icon: Route, title: 'Entrega em rota', text: `Entrega ${d.id} com ${d.driver} entrou em rota.` }) }} onCreate={(d) => { setDeliveriesState((prev) => [d, ...prev]); notify(`Entrega ${d.id} criada com sucesso! O entregador será notificado sobre os pedidos em separação.`); addNotif('notifDeliveries', { icon: Truck, title: 'Nova entrega criada', text: `Entrega ${d.id} com ${d.driver} foi criada e está planejada.` }) }} />}
      {selectedDelivery && <DeliveryDetailModal delivery={deliveriesState.find((d) => d.id === selectedDelivery.id) || selectedDelivery} onClose={() => setSelectedDelivery(null)} orders={orders} onCancel={cancelDelivery} onRemove={removeDelivery} onReactivate={reactivateDelivery} onEdit={(d) => { setEditDelivery(d); setSelectedDelivery(null) }} onSelectOrder={setSelectedOrder} />}
      {selectedOrder && (() => {
        const _linkedDelivery = deliveriesState.find((d) => d.orderIds?.includes(selectedOrder.id))
        const _canRemove = !selectedOrder.isDeleted && selectedOrder.status !== 'Entregue' && selectedOrder.status !== 'Rota'
        return <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} updateOrderStatus={updateOrderStatus} createInvoice={createInvoice} onRemove={_canRemove ? () => setRemoveConfirmOrder(selectedOrder) : null} canRemove={_canRemove} onReactivate={selectedOrder.isDeleted ? () => setReactivateConfirmOrder(selectedOrder) : null} onEdit={() => { setEditOrder(selectedOrder); setSelectedOrder(null) }} receiveOrdersActive={receiveOrdersActive} />
      })()}
      {vehiclesOpen && <VehiclesModal
        onClose={() => setVehiclesOpen(false)}
        vehicles={vehiclesState}
        onCreate={(v) => {
          fetch(`${API_URL}/api/vehicles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(v),
          })
            .then((r) => r.json())
            .then((data) => { if (data.vehicle) setVehiclesState((prev) => [...prev, data.vehicle]) })
            .catch(() => {})
        }}
        onUpdate={(v) => {
          setVehiclesState((prev) => prev.map((x) => x.id === v.id ? v : x))
          fetch(`${API_URL}/api/vehicles`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(v),
          }).catch(() => {})
        }}
        onRemove={(id) => {
          setVehiclesState((prev) => prev.filter((x) => x.id !== id))
          fetch(`${API_URL}/api/vehicles`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          }).catch(() => {})
        }}
      />}
      {(newOrderOpen || editOrder) && (() => {
        const _linkedDelivery = editOrder ? deliveriesState.find((d) => d.orderIds?.includes(editOrder.id)) : null
        const _lockedEdit = !!(editOrder && editOrder.status === 'Rota' && _linkedDelivery?.status === 'Em rota')
        const _notesOnlyEdit = !!(editOrder && editOrder.status === 'Entregue')
        return <NewOrderModal onClose={() => { setNewOrderOpen(false); setEditOrder(null) }} onCreateOrder={createOrder} onUpdateOrder={updateOrder} editOrder={editOrder} clients={clientsState} lockedEdit={_lockedEdit} notesOnlyEdit={_notesOnlyEdit} products={apiProductsState} automationLockClient={!!(receiveOrdersActive && editOrder && editOrder.status === 'Recebido')} />
      })()}
      {editProduct && <NewProductModal editProduct={editProduct} onClose={() => setEditProduct(null)} onCreated={() => {}} onUpdated={() => { setStockRefreshKey((k) => k + 1); notify('Produto atualizado com sucesso!') }} />}
      {removeConfirmOrder && (
        <div className="cancelSepOverlay" onClick={(e) => { if (e.target.classList.contains('cancelSepOverlay')) setRemoveConfirmOrder(null) }}>
          <div className="cancelSepModal">
            <h3>Remover pedido?</h3>
            <p>O pedido <b>{removeConfirmOrder.id}</b> de <b>{removeConfirmOrder.customer}</b> será removido permanentemente do sistema.</p>
            <div className="cancelSepActions">
              <button className="cancelSepConfirm" style={{background:'var(--red)'}} onClick={() => removeOrder(removeConfirmOrder.id)}>Sim, remover pedido</button>
              <button className="cancelSepDeny" onClick={() => setRemoveConfirmOrder(null)}>Não, voltar</button>
            </div>
          </div>
        </div>
      )}
      {reactivateConfirmOrder && (
        <div className="cancelSepOverlay" onClick={(e) => { if (e.target.classList.contains('cancelSepOverlay')) setReactivateConfirmOrder(null) }}>
          <div className="cancelSepModal">
            <h3>Reativar pedido?</h3>
            <p>O pedido <b>{reactivateConfirmOrder.id}</b> de <b>{reactivateConfirmOrder.customer}</b> será reativado com o status <b>Recebido</b>.</p>
            <div className="cancelSepActions">
              <button className="cancelSepConfirm" style={{background:'var(--green, #22c55e)'}} onClick={() => reactivateOrder(reactivateConfirmOrder.id)}>Sim, reativar pedido</button>
              <button className="cancelSepDeny" onClick={() => setReactivateConfirmOrder(null)}>Não, voltar</button>
            </div>
          </div>
        </div>
      )}
      {removeConfirmProduct && (
        <div className="cancelSepOverlay" onClick={(e) => { if (e.target.classList.contains('cancelSepOverlay')) setRemoveConfirmProduct(null) }}>
          <div className="cancelSepModal">
            <h3>Remover produto?</h3>
            <p>O produto <b>{removeConfirmProduct.name}</b> será removido permanentemente do estoque.</p>
            <div className="cancelSepActions">
              <button className="cancelSepConfirm" style={{background:'var(--red)'}} onClick={() => removeProduct(removeConfirmProduct.id)}>Sim, remover produto</button>
              <button className="cancelSepDeny" onClick={() => setRemoveConfirmProduct(null)}>Não, voltar</button>
            </div>
          </div>
        </div>
      )}
      {newClientOpen && (
        <NewClientModal
          onClose={() => { setNewClientOpen(false); setEditClient(null) }}
          onCreated={(c) => { setClientsState((prev) => [c, ...prev]); notify(`Cliente ${c.establishmentName} cadastrado com sucesso!`); addNotif('notifClients', { icon: Users, title: 'Novo cliente cadastrado', text: `${c.establishmentName} foi adicionado à carteira de clientes.` }) }}
          editClient={editClient}
          onUpdated={(c) => { setClientsState((prev) => prev.map((x) => x.id === c.id ? c : x)); setSelectedClient(c); fetchOrders(); notify(`Cliente ${c.establishmentName} atualizado com sucesso!`) }}
        />
      )}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onEdit={(c) => { setSelectedClient(null); setEditClient(c); setNewClientOpen(true) }}
          onRemove={(c) => { setSelectedClient(null); setRemoveConfirmClient(c) }}
        />
      )}
      {removeConfirmClient && (
        <div className="cancelSepOverlay" onClick={(e) => { if (e.target.classList.contains('cancelSepOverlay')) setRemoveConfirmClient(null) }}>
          <div className="cancelSepModal">
            <h3>Remover cliente?</h3>
            <p>O cliente <b>{removeConfirmClient.establishmentName}</b> será removido permanentemente do sistema.</p>
            <div className="cancelSepActions">
              <button className="cancelSepConfirm" style={{ background: 'var(--red)' }} onClick={async () => {
                try {
                  await fetch(`${API_URL}/api/clients`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: removeConfirmClient.id, userId: removeConfirmClient.userId }),
                  })
                } catch {}
                setClientsState((prev) => prev.filter((c) => c.id !== removeConfirmClient.id))
                if (selectedClient?.id === removeConfirmClient.id) setSelectedClient(null)
                setRemoveConfirmClient(null)
                notify(`Cliente ${removeConfirmClient.establishmentName} removido.`)
              }}>Sim, remover cliente</button>
              <button className="cancelSepDeny" onClick={() => setRemoveConfirmClient(null)}>Não, voltar</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  )
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Informe e-mail e senha para acessar o painel.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/employee-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'E-mail ou senha incorretos.')
        return
      }
      if (rememberMe) {
        localStorage.setItem('saborsan_employee', JSON.stringify(data.employee))
      } else {
        localStorage.removeItem('saborsan_employee')
      }
      onLogin(data.employee)
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="loginPage">
      <section className="loginHero">
        <div className="loginCard">
          <div className="loginCardTop">
            <img src={BASE + 'images/logo-saborsan.png'} alt="Saborsan" />
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
          <label>Senha<input type="password" placeholder="••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          <label className="rememberMeRow"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /><span>Manter-me conectado</span></label>
          {error && <small className="errorText">{error}</small>}
          <button className="btnPrimary" type="submit" disabled={loading}>
            {loading ? 'Verificando...' : 'Entrar no sistema'}
          </button>
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
        <img src={BASE + 'images/new-work-station-2.png'} alt="New work station 2" />
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

function Orders({ orders, ordersLoading, onSelect, updateOrderStatus, createInvoice, onGerarNota, onNewOrder, onVerNota, search = '', receiveOrdersActive = false }) {
  const [filter, setFilter] = useState('Todos')
  const activeOrders = orders.filter((o) => !o.isDeleted)
  const removedOrders = orders.filter((o) => o.isDeleted)
  const byStatus = filter === 'Todos' ? activeOrders : filter === 'Removido' ? removedOrders : activeOrders.filter((o) => o.status === filter)
  const filtered = !search ? byStatus : byStatus.filter((o) => o.customer.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase()))
  return (
    <section className="pageStack">
      <div className="sectionHeader">
        <div><p>Pedidos recebidos do app, WhatsApp e vendedores</p></div>
        <button className="btnSolid" onClick={onNewOrder}><Plus size={18} /> Novo pedido</button>
      </div>
      <div className="filtersRow">
        {['Todos', 'Recebido', 'Separação', 'Pronto', 'Rota', 'Entregue', 'Removido'].map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}><Filter size={15} />{item}</button>)}
      </div>
      {ordersLoading && <p className="loadingText">Carregando pedidos...</p>}
      <div className="ordersBoard">
        {!ordersLoading && filtered.length === 0 && <p className="emptyText">Nenhum pedido encontrado.</p>}
        {filtered.map((order) => (
          <article className="orderCard" key={order.id}>
            <div className="orderTop"><div><b>{order.id}</b><span>{order.source}</span></div><div style={{display:'flex',gap:'6px',alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}><Status status={filter === 'Removido' ? 'Removido' : order.status} />{order.status === 'Pronto' && order.nfeData && (order.nfeData.nfeStatus === 'AUTHORIZED' ? <span className="nfeSubStatus success">Nota emitida com sucesso</span> : <span className="nfeSubStatus error">Erro na emição da nota</span>)}</div></div>
            <h3>{order.customer}</h3>
            <p>{order.city} • {order.whatsapp}</p>
            <div className="orderProducts">{order.products.map((p) => <span key={p.name}>{p.qty} {p.unit} • {p.name}</span>)}</div>
            <div className="orderFooter"><strong>{money(order.value)}</strong><small>Entrega: {order.delivery}</small></div>
            <div className="orderActions">
              <button onClick={() => onSelect(order)}>Detalhes</button>
              {order.status === 'Recebido' && (
                receiveOrdersActive
                  ? <button style={{background:'var(--orange)',color:'#fff',opacity:0.5,cursor:'not-allowed'}} disabled title="Desabilitado porque a automação 'Receber pedidos do app' está ativada">Separar</button>
                  : <button style={{background:'var(--orange)',color:'#fff'}} onClick={() => updateOrderStatus(order.id, 'Separação')}>Separar</button>
              )}
              {order.status === 'Pronto' && order.nfeData?.nfeStatus !== 'AUTHORIZED' && <button onClick={() => onGerarNota(order)}>Gerar nota</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Invoices({ orders, onGerarNota, onVerNota, search = '' }) {
  const fiscalHistory = orders.filter((o) => o.nfeData && (!search || o.customer.toLowerCase().includes(search.toLowerCase())))
  const readyToEmit = orders.filter((o) => !o.isDeleted && o.status === 'Pronto' && o.nfeData?.nfeStatus !== 'AUTHORIZED' && (!search || o.customer.toLowerCase().includes(search.toLowerCase())))

  const [printOrder, setPrintOrder] = useState(null)

  const formatNfeDate = (o) => {
    const iso = o.nfeData?.authorizedAt
    if (!iso) return null
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  return (
    <>
      <section className="pageStack">
        <div className="sectionHeader"><div><p>Geração e acompanhamento fiscal</p></div></div>
      <div className="contentGrid twoCols">
        <div className="card">
          <div className="cardHeader"><div><p>Notas geradas</p><h3>Histórico fiscal</h3></div><ReceiptText /></div>
          <div className="tableLike actionRows">
            {fiscalHistory.length === 0 && <p className="emptyText">Nenhuma nota emitida ainda.</p>}
            {fiscalHistory.map((o) => (
              <div key={o.id}>
                <b>{o.nfeData.number ? `NF-e ${o.nfeData.number}` : o.id}{formatNfeDate(o) ? ` • ${formatNfeDate(o)}` : ''}</b>
                <span>{o.customer}</span>
                <strong>{money(o.value)}</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Status status={o.nfeData.nfeStatus === 'AUTHORIZED' ? 'Emitida' : 'Erro'} />
                  <button onClick={() => onVerNota(o)}>Ver nota</button>
                  {o.nfeData.nfeStatus === 'AUTHORIZED' && (
                    <button className="printDanfeBtn" onClick={() => setPrintOrder(o)} title="Imprimir DANFE">
                      <Printer size={20} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="cardHeader"><div><p>Pedidos prontos para emissão</p><h3>Gerar notas</h3></div><FileText /></div>
          <div className="tableLike actionRows">
            {readyToEmit.length === 0 && <p className="emptyText">Nenhum pedido pendente de nota.</p>}
            {readyToEmit.map((order) => (
              <div key={order.id}>
                <b>{order.id}</b>
                <span>{order.customer}</span>
                <strong>{money(order.value)}</strong>
                <button onClick={() => onGerarNota(order)}>Gerar nota</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
    {printOrder && <PrintDanfeModal order={printOrder} onClose={() => setPrintOrder(null)} />}
    </>
  )
}

const DEFAULT_GRUPOS = ['J.A Alimentos','Herança da serra',"Lanxe's",'Sabor da fruta','Garopaba','Caseirão','Longa vida','Mein haus','Ferraz','Belfoods','Mandiok','Polpa norte','Cordeiro','Saborsan','Nono paulino','Aipim','Demarchi','EasyChef']
const DEFAULT_SUBGRUPOS = ['Padrão','J.A Alimentos','Herança da serra',"Lanxe's",'Sabor da fruta','Garopaba','Caseirão','Longa vida','Mein haus','Ferraz','Belfoods','Mandiok','Polpa norte','Cordeiro','Saborsan','Nono paulino','Aipim','Demarchi','EasyChef']

function NewProductModal({ onClose, onCreated, editProduct, onUpdated, bgImport, onStartBgAnalysis, onClearBgImport }) {
  const [tab, setTab] = useState('manual')
  const [form, setForm] = useState(() => editProduct ? {
    name: editProduct.name || '',
    category: editProduct.category || '',
    price: editProduct.price ? String(editProduct.price) : '',
    availableQuantity: editProduct.stock != null ? String(editProduct.stock) : '',
    packaging: editProduct.unit || editProduct.packaging || '',
    unitQuantity: editProduct.unitQuantity != null ? String(editProduct.unitQuantity) : '',
    packagingWeight: editProduct.packagingWeight != null ? String(editProduct.packagingWeight) : '',
    conservation: editProduct.temperature || editProduct.conservation || '',
    description: editProduct.description || '',
    details: editProduct.details || '',
    preparation: editProduct.preparation || '',
    idealFor: editProduct.idealFor || '',
    badge: editProduct.badge || '',
    imageUrl: editProduct.image || editProduct.imageUrl || '',
    group: editProduct.group || '',
    subGroup: editProduct.subGroup || '',
  } : {
    name: '', category: '', price: '', availableQuantity: '',
    packaging: '', unitQuantity: '', packagingWeight: '',
    conservation: '', description: '', details: '',
    preparation: '', idealFor: '', badge: '', imageUrl: '',
    group: '', subGroup: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(editProduct ? (editProduct.image || editProduct.imageUrl || '') : '')

  const [customGroups, setCustomGroups] = useState(() => { try { return JSON.parse(localStorage.getItem('saborsan_custom_grupos') || '[]') } catch { return [] } })
  const [customSubGroups, setCustomSubGroups] = useState(() => { try { return JSON.parse(localStorage.getItem('saborsan_custom_subgrupos') || '[]') } catch { return [] } })
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [showAddSubGroup, setShowAddSubGroup] = useState(false)
  const [addGroupInput, setAddGroupInput] = useState('')
  const [addSubGroupInput, setAddSubGroupInput] = useState('')

  const allGrupos = [...new Set([...DEFAULT_GRUPOS, ...customGroups, ...(editProduct?.group ? [editProduct.group] : [])])]
  const allSubGrupos = [...new Set([...DEFAULT_SUBGRUPOS, ...customSubGroups, ...(editProduct?.subGroup ? [editProduct.subGroup] : [])])]

  const handleAddGroup = () => {
    const v = addGroupInput.trim()
    if (!v || allGrupos.includes(v)) { setShowAddGroup(false); setAddGroupInput(''); return }
    const updated = [...customGroups, v]
    setCustomGroups(updated)
    localStorage.setItem('saborsan_custom_grupos', JSON.stringify(updated))
    set('group', v)
    setAddGroupInput('')
    setShowAddGroup(false)
  }

  const handleAddSubGroup = () => {
    const v = addSubGroupInput.trim()
    if (!v || allSubGrupos.includes(v)) { setShowAddSubGroup(false); setAddSubGroupInput(''); return }
    const updated = [...customSubGroups, v]
    setCustomSubGroups(updated)
    localStorage.setItem('saborsan_custom_subgrupos', JSON.stringify(updated))
    set('subGroup', v)
    setAddSubGroupInput('')
    setShowAddSubGroup(false)
  }
  const imageInputRef = useRef(null)

  // Upload tab state
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSubmitting, setUploadSubmitting] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const fileInputRef = useRef(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const isDirty = !editProduct ||
    imageFile !== null ||
    form.name !== (editProduct.name || '') ||
    form.category !== (editProduct.category || '') ||
    form.price !== (editProduct.price ? String(editProduct.price) : '') ||
    form.availableQuantity !== (editProduct.stock != null ? String(editProduct.stock) : '') ||
    form.packaging !== (editProduct.unit || editProduct.packaging || '') ||
    form.unitQuantity !== (editProduct.unitQuantity != null ? String(editProduct.unitQuantity) : '') ||
    form.packagingWeight !== (editProduct.packagingWeight != null ? String(editProduct.packagingWeight) : '') ||
    form.conservation !== (editProduct.temperature || editProduct.conservation || '') ||
    form.description !== (editProduct.description || '') ||
    form.details !== (editProduct.details || '') ||
    form.preparation !== (editProduct.preparation || '') ||
    form.idealFor !== (editProduct.idealFor || '') ||
    form.badge !== (editProduct.badge || '') ||
    form.imageUrl !== (editProduct.image || editProduct.imageUrl || '') ||
    form.group !== (editProduct.group || '') ||
    form.subGroup !== (editProduct.subGroup || '')

  const canSubmit = editProduct
    ? (form.name.trim() && isDirty)
    : (form.name.trim() && form.category.trim() && form.price.trim() && form.packaging && form.unitQuantity.trim() && form.packagingWeight.trim())

  const submitManual = async (e) => {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitError('')
    setSubmitting(true)
    try {
      let resolvedImageUrl = form.imageUrl || null

      if (imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        const uploadRes = await fetch(`${API_URL}/api/upload-image`, { method: 'POST', body: fd })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Erro ao fazer upload da imagem.')
        resolvedImageUrl = uploadData.url
      }

      if (editProduct) {
        const res = await fetch(`${API_URL}/api/products`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editProduct.id,
            name: form.name.trim(),
            category: form.category.trim(),
            price: form.price,
            availableQuantity: parseInt(form.availableQuantity || '0', 10),
            packaging: form.packaging || null,
            unitQuantity: parseInt(form.unitQuantity || '0', 10),
            packagingWeight: parseFloat(form.packagingWeight || '0'),
            conservation: form.conservation || null,
            description: form.description || null,
            details: form.details || null,
            preparation: form.preparation || null,
            idealFor: form.idealFor || null,
            badge: form.badge || null,
            imageUrl: resolvedImageUrl,
            group: form.group || null,
            subGroup: form.subGroup || null,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar produto')
        onUpdated && onUpdated()
        onClose()
        return
      }
      const res = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category.trim(),
          price: form.price,
          availableQuantity: parseInt(form.availableQuantity || '0', 10),
          packaging: form.packaging || null,
          unitQuantity: parseInt(form.unitQuantity || '0', 10),
          packagingWeight: parseFloat(form.packagingWeight || '0'),
          conservation: form.conservation || null,
          description: form.description || null,
          details: form.details || null,
          preparation: form.preparation || null,
          idealFor: form.idealFor || null,
          badge: form.badge || null,
          imageUrl: resolvedImageUrl,
          group: form.group || null,
          subGroup: form.subGroup || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar produto')
      onCreated({ isBatch: false, name: form.name.trim() })
      onClose()
    } catch (err) {
      setSubmitError(err.message || (editProduct ? 'Erro ao atualizar produto. Tente novamente.' : 'Erro ao criar produto. Tente novamente.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleFile = (file) => {
    setUploadResult(null)
    setUploadError('')
    if (!file) return
    onStartBgAnalysis?.(file)
  }

  const [rowUpdatedSet, setRowUpdatedSet] = useState(new Set())
  const [rowApplyingSet, setRowApplyingSet] = useState(new Set())

  const applyNewInfo = async (row, index) => {
    setRowApplyingSet((prev) => new Set(prev).add(index))
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.existingId,
          name: row.name,
          category: row.category,
          price: row.price,
          availableQuantity: row.availableQuantity,
          packaging: row.packaging,
          unitQuantity: row.unitQuantity,
          packagingWeight: row.packagingWeight,
          conservation: row.conservation,
          group: row.group,
          subGroup: row.subGroup,
          badge: row.badge,
          description: row.description,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar produto')
      setRowUpdatedSet((prev) => new Set(prev).add(index))
    } catch (err) {
      setUploadError(err.message || 'Erro ao atualizar produto.')
    } finally {
      setRowApplyingSet((prev) => { const s = new Set(prev); s.delete(index); return s })
    }
  }

  const submitUpload = async () => {
    const parsedRows = bgImport?.parsedRows
    if (!parsedRows) return
    const valid = parsedRows.filter((r) => r.valid && !r.isExistingWithChanges && !r.isExistingNoChanges)
    if (!valid.length) return
    setUploadSubmitting(true)
    setUploadResult(null)
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: valid }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro no envio')
      setUploadResult(data)
      const totalAffected = (data.created?.length || 0) + (data.updated?.length || 0)
      if (totalAffected) { onCreated({ isBatch: true, count: totalAffected }); onClearBgImport?.() }
    } catch (err) {
      setUploadError(err.message || 'Erro ao enviar produtos.')
    } finally {
      setUploadSubmitting(false)
    }
  }

  return (
    <div className="modalBackdrop">
      <div className="detailModal newProductModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>Estoque</span>
            <h2>{editProduct ? 'Editar produto' : 'Entrada de estoque'}</h2>
            <p>{editProduct ? 'Altere os dados do produto e salve as modificações' : 'Cadastre um novo produto manualmente ou importe via arquivo'}</p>
          </div>
        </div>

        <div className="newProductTabs">
          <button className={`newProductTab${tab === 'manual' ? ' active' : ''}`} onClick={() => setTab('manual')}>
            <ClipboardEdit size={16} /> {editProduct ? 'Dados do produto' : 'Cadastro manual'}
          </button>
          {!editProduct && (
            <button className={`newProductTab${tab === 'upload' ? ' active' : ''}`} onClick={() => setTab('upload')}>
              <UploadCloud size={16} /> Importar arquivo
            </button>
          )}
        </div>

        {tab === 'manual' && (
          <form onSubmit={submitManual} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <div className="newProductScrollArea">
              <div className="newProductForm">
                <label className="full">Nome do produto *
                  <input placeholder="Ex: Pão de Queijo Tradicional" value={form.name} onChange={(e) => set('name', e.target.value)} required />
                </label>
                <label>Categoria *
                  <input placeholder="Ex: Pão de queijo" value={form.category} onChange={(e) => set('category', e.target.value)} required />
                </label>
                <label>Preço base (R$) *
                  <input type="number" step="0.01" min="0" placeholder="0,00" value={form.price} onChange={(e) => set('price', e.target.value)} required />
                </label>
                <label>Quantidade em estoque
                  <input type="number" min="0" placeholder="0" value={form.availableQuantity} onChange={(e) => set('availableQuantity', e.target.value)} />
                </label>
                <label>Embalagem / Unidade *
                  <CustomSelect
                    value={form.packaging}
                    onChange={(v) => set('packaging', v)}
                    placeholder="Selecionar..."
                    options={[
                      { value: 'Caixa', label: 'Caixa' },
                      { value: 'Pacote', label: 'Pacote' },
                    ]}
                  />
                </label>
                <label>Qtd. na unidade *
                  <input type="number" min="0" placeholder="Ex: 10" value={form.unitQuantity} onChange={(e) => set('unitQuantity', e.target.value)} />
                </label>
                <label>Peso da embalagem (kg) *
                  <input type="number" step="0.001" min="0" placeholder="Ex: 5.000" value={form.packagingWeight} onChange={(e) => set('packagingWeight', e.target.value)} />
                </label>
                <label>Conservação / Temperatura
                  <input placeholder="Ex: -18°C, Refrigerado" value={form.conservation} onChange={(e) => set('conservation', e.target.value)} />
                </label>
                <label>Grupo
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <CustomSelect
                        value={form.group}
                        onChange={(v) => set('group', v)}
                        placeholder="Selecionar grupo..."
                        options={allGrupos.map((g) => ({ value: g, label: g }))}
                      />
                    </div>
                    <button type="button" className="addGroupBtn" title="Adicionar novo grupo" onClick={() => { setShowAddGroup((v) => !v); setAddGroupInput('') }}>
                      <Plus size={14} />
                    </button>
                  </div>
                  {showAddGroup && (
                    <div className="addGroupInline">
                      <input
                        value={addGroupInput}
                        onChange={(e) => setAddGroupInput(e.target.value)}
                        placeholder="Nome do novo grupo..."
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGroup() } }}
                        autoFocus
                      />
                      <button type="button" onClick={handleAddGroup}><CheckCircle2 size={14} /></button>
                    </div>
                  )}
                </label>
                <label>Sub grupo
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <CustomSelect
                        value={form.subGroup}
                        onChange={(v) => set('subGroup', v)}
                        placeholder="Selecionar sub grupo..."
                        options={allSubGrupos.map((g) => ({ value: g, label: g }))}
                      />
                    </div>
                    <button type="button" className="addGroupBtn" title="Adicionar novo sub grupo" onClick={() => { setShowAddSubGroup((v) => !v); setAddSubGroupInput('') }}>
                      <Plus size={14} />
                    </button>
                  </div>
                  {showAddSubGroup && (
                    <div className="addGroupInline">
                      <input
                        value={addSubGroupInput}
                        onChange={(e) => setAddSubGroupInput(e.target.value)}
                        placeholder="Nome do novo sub grupo..."
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubGroup() } }}
                        autoFocus
                      />
                      <button type="button" onClick={handleAddSubGroup}><CheckCircle2 size={14} /></button>
                    </div>
                  )}
                </label>
                <label className="full">Descrição
                  <input placeholder="Breve descrição do produto" value={form.description} onChange={(e) => set('description', e.target.value)} />
                </label>
                <label className="full">Detalhes
                  <textarea rows={2} placeholder="Informações adicionais sobre o produto" value={form.details} onChange={(e) => set('details', e.target.value)} />
                </label>
                <label>Indicado para
                  <input placeholder="Ex: Padarias, cafeterias" value={form.idealFor} onChange={(e) => set('idealFor', e.target.value)} />
                </label>
                <label>Modo de preparo
                  <input placeholder="Ex: Assar por 15 min a 180°C" value={form.preparation} onChange={(e) => set('preparation', e.target.value)} />
                </label>
                <label>Badge / Destaque
                  <input placeholder="Ex: Mais vendido, Novo" value={form.badge} onChange={(e) => set('badge', e.target.value)} />
                </label>
                <div className="imageUploadField full">
                  <span className="imageUploadLabel">Imagem do produto</span>
                  <div className="imageUploadArea" onClick={() => imageInputRef.current?.click()}>
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="imageUploadPreview" />
                    ) : (
                      <div className="imageUploadPlaceholder">
                        <UploadCloud size={28} />
                        <span>Clique para selecionar uma imagem</span>
                        <small>JPG, PNG, WEBP, AVIF ou GIF — máx. 5MB</small>
                      </div>
                    )}
                  </div>
                  {imagePreview && (
                    <button
                      type="button"
                      className="imageUploadRemove"
                      onClick={() => { setImageFile(null); setImagePreview(''); set('imageUrl', '') }}
                    >
                      <X size={14} /> Remover imagem
                    </button>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setImageFile(file)
                      const reader = new FileReader()
                      reader.onload = (ev) => setImagePreview(ev.target.result)
                      reader.readAsDataURL(file)
                      e.target.value = ''
                    }}
                  />
                </div>
              </div>
              {submitError && <small className="errorText" style={{ marginTop: 12, display: 'block' }}>{submitError}</small>}
            </div>
            <div className="newProductFooter">
              <button type="submit" className="btnPrimary" disabled={!canSubmit || submitting}>
                <CheckCircle2 size={17} /> {submitting ? 'Salvando...' : (editProduct ? 'Salvar alterações' : 'Salvar produto')}
              </button>
            </div>
          </form>
        )}

        {tab === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <div className="newProductScrollArea">
              {!bgImport?.parsedRows && !uploadResult && (
                <>
                  {bgImport?.status === 'analyzing' ? (
                    <div className="uploadZone" style={{ cursor: 'default', pointerEvents: 'none' }}>
                      <Sparkles size={40} style={{ color: 'var(--orange)', animation: 'spin 1.5s linear infinite' }} />
                      <p style={{ fontWeight: 600 }}>Analisando documento com IA...</p>
                      <small>A IA está identificando os produtos. Aguarde um momento.</small>
                    </div>
                  ) : (
                    <div
                      className={`uploadZone${dragOver ? ' drag' : ''}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
                    >
                      <UploadCloud size={40} style={{ color: 'var(--orange)' }} />
                      <p>Clique ou arraste o arquivo aqui</p>
                      <small>Formatos aceitos: TXT, CSV, PDF</small>
                      <input ref={fileInputRef} type="file" accept=".txt,.csv,.pdf" onChange={(e) => handleFile(e.target.files[0])} />
                    </div>
                  )}
                  {bgImport?.parseError && <small className="errorText" style={{ marginTop: 10, display: 'block' }}>{bgImport.parseError}</small>}
                  {bgImport?.status === 'analyzing' && (
                    <div className="bgImportHint">
                      <Info size={14} /> Você pode fechar esta tela — a análise continuará em segundo plano.
                    </div>
                  )}
                  {!bgImport?.status && (
                    <div className="uploadFormatHint">
                      <b><Sparkles size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Análise inteligente com IA</b>
                      <p style={{ margin: '6px 0 0', fontSize: '.82rem', lineHeight: 1.5 }}>
                        Envie qualquer documento com informações de produtos: tabelas, listas, notas fiscais, planilhas exportadas (TXT/CSV) ou PDFs. A IA extrai automaticamente nome, categoria, preço, quantidade e embalagem de múltiplos produtos. Imagens dos produtos não são extraídas.
                      </p>
                    </div>
                  )}
                </>
              )}

              {bgImport?.parsedRows && !uploadResult && (
                <div className="uploadPreview">
                  <div className="uploadPreviewHeader">
                    <h4>{bgImport.parsedRows.length} produto(s) identificado(s) — {bgImport.parsedRows.filter((r) => r.valid).length} válido(s)</h4>
                    <div className="uploadBtnRow">
                      <button className="btnReset" onClick={() => { onClearBgImport?.(); setUploadError(''); fileInputRef.current && (fileInputRef.current.value = '') }}>
                        <X size={14} /> Trocar arquivo
                      </button>
                    </div>
                  </div>
                  <table className="uploadPreviewTable">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Categoria</th>
                        <th>Preço</th>
                        <th>Qtd.</th>
                        <th>Embalagem</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bgImport.parsedRows.map((row, i) => (
                        <tr key={i} className={`${row.valid ? '' : 'err'}${row.isExistingWithChanges ? ' rowChanged' : ''}${row.isExistingNoChanges ? ' rowNoChanges' : ''}`}>
                          <td>{row.name || <em>—</em>}</td>
                          <td>{row.category || <em>—</em>}</td>
                          <td>{row.price}</td>
                          <td>{row.availableQuantity}</td>
                          <td>{row.packaging || '—'}</td>
                          <td>
                            {row.isExistingWithChanges && (
                              rowUpdatedSet.has(i)
                                ? <span className="rowUpdatedBadge">Atualizado</span>
                                : <button className="btnApplyNewInfo" disabled={rowApplyingSet.has(i)} onClick={() => applyNewInfo(row, i)}>
                                    {rowApplyingSet.has(i) ? 'Salvando...' : 'Usar novas informações'}
                                  </button>
                            )}
                            {row.isExistingNoChanges && <span className="rowIgnoredBadge">Já existe</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {uploadError && <small className="errorText" style={{ marginTop: 8, display: 'block' }}>{uploadError}</small>}
                </div>
              )}

              {uploadResult && (
                <div style={{ padding: '16px 0' }}>
                  {uploadResult.created?.length > 0 && (
                    <div className="noteBox" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                      <b style={{ color: '#16a34a' }}><CheckCircle2 size={16} style={{ verticalAlign: 'middle' }} /> {uploadResult.created.length} produto(s) criado(s) com sucesso</b>
                    </div>
                  )}
                  {uploadResult.updated?.length > 0 && (
                    <div className="noteBox" style={{ background: '#eff6ff', borderColor: '#bfdbfe', marginTop: uploadResult.created?.length ? 10 : 0 }}>
                      <b style={{ color: '#2563eb' }}><CheckCircle2 size={16} style={{ verticalAlign: 'middle' }} /> {uploadResult.updated.length} produto(s) atualizado(s)</b>
                    </div>
                  )}
                  {uploadResult.errors?.length > 0 && (
                    <div className="noteBox" style={{ background: '#fff5f5', borderColor: '#fecaca', marginTop: 10 }}>
                      <b style={{ color: 'var(--red)' }}>{uploadResult.errors.length} produto(s) com erro</b>
                      {uploadResult.errors.map((e, i) => <p key={i} style={{ fontSize: '.82rem', margin: '4px 0 0' }}>{e.name}: {e.error}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="newProductFooter">
              <button type="button" onClick={onClose}>Fechar</button>
              {bgImport?.parsedRows && !uploadResult && (() => {
                const importableCount = bgImport.parsedRows.filter((r) => r.valid && !r.isExistingWithChanges && !r.isExistingNoChanges).length
                return importableCount > 0 ? (
                  <button
                    className="btnPrimary"
                    disabled={uploadSubmitting}
                    onClick={submitUpload}
                  >
                    <UploadCloud size={17} /> {uploadSubmitting ? 'Importando...' : `Importar ${importableCount} produto(s)`}
                  </button>
                ) : null
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function BgImportPanel({ bgImport, onClose, onImportDone, onClearBgImport }) {
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadSubmitting, setUploadSubmitting] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [rowUpdatedSet, setRowUpdatedSet] = useState(new Set())
  const [rowApplyingSet, setRowApplyingSet] = useState(new Set())

  const parsedRows = bgImport?.parsedRows

  const applyNewInfo = async (row, index) => {
    setRowApplyingSet((prev) => new Set(prev).add(index))
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.existingId,
          name: row.name,
          category: row.category,
          price: row.price,
          availableQuantity: row.availableQuantity,
          packaging: row.packaging,
          unitQuantity: row.unitQuantity,
          packagingWeight: row.packagingWeight,
          conservation: row.conservation,
          group: row.group,
          subGroup: row.subGroup,
          badge: row.badge,
          description: row.description,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar produto')
      setRowUpdatedSet((prev) => new Set(prev).add(index))
    } catch (err) {
      setUploadError(err.message || 'Erro ao atualizar produto.')
    } finally {
      setRowApplyingSet((prev) => { const s = new Set(prev); s.delete(index); return s })
    }
  }

  const submitUpload = async () => {
    if (!parsedRows) return
    const valid = parsedRows.filter((r) => r.valid && !r.isExistingWithChanges && !r.isExistingNoChanges)
    if (!valid.length) return
    setUploadSubmitting(true)
    setUploadResult(null)
    try {
      const res = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: valid }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro no envio')
      setUploadResult(data)
      const totalAffected = (data.created?.length || 0) + (data.updated?.length || 0)
      if (totalAffected) onImportDone?.({ isBatch: true, count: totalAffected })
    } catch (err) {
      setUploadError(err.message || 'Erro ao enviar produtos.')
    } finally {
      setUploadSubmitting(false)
    }
  }

  return (
    <div className="modalBackdrop">
      <div className="detailModal newProductModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>Estoque</span>
            <h2>Entrada de estoque</h2>
            <p>{bgImport?.status === 'analyzing' ? 'Análise de documento em andamento...' : `Arquivo: ${bgImport?.fileName || ''}`}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <div className="newProductScrollArea">
            {!parsedRows && !uploadResult && (
              bgImport?.status === 'analyzing' ? (
                <div className="uploadZone" style={{ cursor: 'default', pointerEvents: 'none' }}>
                  <Sparkles size={40} style={{ color: 'var(--orange)', animation: 'spin 1.5s linear infinite' }} />
                  <p style={{ fontWeight: 600 }}>Analisando documento com IA...</p>
                  <small>A IA está identificando os produtos. Aguarde um momento.</small>
                </div>
              ) : (
                <div className="uploadZone" style={{ cursor: 'default', pointerEvents: 'none', borderStyle: 'solid', borderColor: 'var(--red-soft, #fca5a5)' }}>
                  <AlertTriangle size={40} style={{ color: 'var(--red, #ef4444)' }} />
                  <p style={{ fontWeight: 600 }}>Nenhum produto identificado</p>
                  <small>{bgImport?.parseError || 'Não foi possível extrair produtos do documento.'}</small>
                </div>
              )
            )}

            {parsedRows && !uploadResult && (
              <div className="uploadPreview">
                <div className="uploadPreviewHeader">
                  <h4>{parsedRows.length} produto(s) identificado(s) — {parsedRows.filter((r) => r.valid).length} válido(s)</h4>
                  <div className="uploadBtnRow">
                    <button className="btnReset" onClick={onClearBgImport}>
                      <X size={14} /> Cancelar importação
                    </button>
                  </div>
                </div>
                <table className="uploadPreviewTable">
                  <thead>
                    <tr><th>Nome</th><th>Categoria</th><th>Preço</th><th>Qtd.</th><th>Embalagem</th><th></th></tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, i) => (
                      <tr key={i} className={`${row.valid ? '' : 'err'}${row.isExistingWithChanges ? ' rowChanged' : ''}${row.isExistingNoChanges ? ' rowNoChanges' : ''}`}>
                        <td>{row.name || <em>—</em>}</td>
                        <td>{row.category || <em>—</em>}</td>
                        <td>{row.price}</td>
                        <td>{row.availableQuantity}</td>
                        <td>{row.packaging || '—'}</td>
                        <td>
                          {row.isExistingWithChanges && (
                            rowUpdatedSet.has(i)
                              ? <span className="rowUpdatedBadge">Atualizado</span>
                              : <button className="btnApplyNewInfo" disabled={rowApplyingSet.has(i)} onClick={() => applyNewInfo(row, i)}>
                                  {rowApplyingSet.has(i) ? 'Salvando...' : 'Usar novas informações'}
                                </button>
                          )}
                          {row.isExistingNoChanges && <span className="rowIgnoredBadge">Já existe</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {uploadError && <small className="errorText" style={{ marginTop: 8, display: 'block' }}>{uploadError}</small>}
              </div>
            )}

            {uploadResult && (
              <div style={{ padding: '16px 0' }}>
                {uploadResult.created?.length > 0 && (
                  <div className="noteBox" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                    <b style={{ color: '#16a34a' }}><CheckCircle2 size={16} style={{ verticalAlign: 'middle' }} /> {uploadResult.created.length} produto(s) criado(s) com sucesso</b>
                  </div>
                )}
                {uploadResult.updated?.length > 0 && (
                  <div className="noteBox" style={{ background: '#eff6ff', borderColor: '#bfdbfe', marginTop: uploadResult.created?.length ? 10 : 0 }}>
                    <b style={{ color: '#2563eb' }}><CheckCircle2 size={16} style={{ verticalAlign: 'middle' }} /> {uploadResult.updated.length} produto(s) atualizado(s)</b>
                  </div>
                )}
                {uploadResult.errors?.length > 0 && (
                  <div className="noteBox" style={{ background: '#fff5f5', borderColor: '#fecaca', marginTop: 10 }}>
                    <b style={{ color: 'var(--red)' }}>{uploadResult.errors.length} produto(s) com erro</b>
                    {uploadResult.errors.map((e, i) => <p key={i} style={{ fontSize: '.82rem', margin: '4px 0 0' }}>{e.name}: {e.error}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="newProductFooter">
            <button type="button" onClick={onClose}>Fechar</button>
            {parsedRows && !uploadResult && (() => {
              const importableCount = parsedRows.filter((r) => r.valid && !r.isExistingWithChanges && !r.isExistingNoChanges).length
              return importableCount > 0 ? (
                <button
                  className="btnPrimary"
                  disabled={uploadSubmitting}
                  onClick={submitUpload}
                >
                  <UploadCloud size={17} /> {uploadSubmitting ? 'Importando...' : `Importar ${importableCount} produto(s)`}
                </button>
              ) : null
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stock({ onProduct, refreshKey, search = '', addNotif, bgImport, onStartBgAnalysis, onClearBgImport }) {
  const [stockProducts, setStockProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [newProductOpen, setNewProductOpen] = useState(false)
  const [viewMode, setViewMode] = useState('grid')
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const viewMenuRef = useRef(null)
  const notifiedLowStockRef = useRef(new Set())

  const fetchProducts = () => {
    setLoading(true)
    fetch(`${API_URL}/api/products`)
      .then((r) => r.json())
      .then((data) => {
        if (data.products) {
          setStockProducts(data.products)
          if (addNotif) {
            const alertPct = (() => { try { return parseFloat(JSON.parse(localStorage.getItem('saborsan_settings') || '{}').estoqueAlerta) || 10 } catch { return 10 } })()
            data.products.forEach((p) => {
              if (p.min > 0 && !notifiedLowStockRef.current.has(p.id)) {
                const pct = (p.stock / (p.min * 2)) * 100
                if (pct <= alertPct) {
                  const sessionKey = `notif_stock_low_${p.id}`
                  if (!sessionStorage.getItem(sessionKey)) {
                    addNotif('notifStock', { icon: AlertTriangle, type: 'warning', title: 'Estoque abaixo do limite', text: `${p.name} está com estoque abaixo do mínimo configurado (${p.stock} ${p.unit || 'unid.'}).` })
                    sessionStorage.setItem(sessionKey, '1')
                    notifiedLowStockRef.current.add(p.id)
                  }
                }
              }
            })
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchProducts() }, [refreshKey])

  useEffect(() => {
    if (!viewMenuOpen) return
    const handleClick = (e) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target)) setViewMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [viewMenuOpen])

  const filtered = stockProducts.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  // IDs de produtos que compartilham nome e grupo com pelo menos outro produto
  const dupIds = new Set(
    stockProducts
      .filter((p) => stockProducts.some((q) => q.id !== p.id && q.name === p.name && (q.group || '') === (p.group || '')))
      .map((p) => p.id)
  )

  const viewOptions = [
    { key: 'grid', icon: LayoutGrid, label: 'Cards com imagem' },
    { key: 'grid-no-image', icon: Boxes, label: 'Cards sem imagem' },
    { key: 'list', icon: List, label: 'Lista' },
  ]

  return (
    <>
      <section className="pageStack">
        <div className="sectionHeader stockSectionHeader">
          <div><p>Controle de produtos congelados</p></div>
          <div className="viewFilterWrap" ref={viewMenuRef}>
            <button className="viewFilterBtn" onClick={() => setViewMenuOpen(!viewMenuOpen)}>
              <LayoutGrid size={16} /> Visualização <ChevronDown size={14} style={{ transform: viewMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {viewMenuOpen && (
              <div className="viewFilterDropdown">
                {viewOptions.map(({ key, icon: Icon, label }) => (
                  <button key={key} className={viewMode === key ? 'active' : ''} onClick={() => { setViewMode(key); setViewMenuOpen(false) }}>
                    <Icon size={16} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btnSolid" disabled={!!bgImport} onClick={() => !bgImport && setNewProductOpen(true)} title={bgImport ? 'Importação em segundo plano em andamento' : undefined}><PackageCheck size={18} /> Entrada de estoque</button>
        </div>
        {loading && <p className="loadingText">Carregando produtos...</p>}
        {viewMode !== 'list' ? (
          <div className="stockGrid">
            {!loading && filtered.length === 0 && <p className="emptyText">Nenhum produto encontrado.</p>}
            {filtered.map((product) => {
              const percent = product.stock === 0 ? 0 : product.min > 0 ? Math.min(100, Math.round((product.stock / (product.min * 2)) * 100)) : 100
              return (
                <article className="stockCard" key={product.id} onClick={() => onProduct({ ...product, showKg: dupIds.has(product.id) && !!product.packagingWeight })}>
                  {viewMode === 'grid' && (
                    product.image
                      ? <img src={product.image} alt={product.name} />
                      : <div className="stockCardNoImage"><ImageOff size={36} /><span>Sem imagem</span></div>
                  )}
                  <div className="stockBody">
                    <span>{product.category}</span>
                    <h3>{product.name}{dupIds.has(product.id) && product.packagingWeight ? <small style={{fontWeight:400,marginLeft:6}}>{product.packagingWeight}kg</small> : null}</h3>
                    <p>{[product.group, product.description].filter(Boolean).join(' • ')}</p>
                    <div className="stockLevel"><div style={{ width: `${percent}%` }}></div></div>
                    <div className="stockMeta"><b>{product.stock}{product.unit ? ` ${product.unit}` : ''}</b><small>{product.min > 0 ? `Mínimo: ${product.min}` : 'Sem mínimo definido'}</small></div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="stockListView">
            {!loading && filtered.length === 0 && <p className="emptyText">Nenhum produto encontrado.</p>}
            {filtered.map((product) => {
              const percent = product.stock === 0 ? 0 : product.min > 0 ? Math.min(100, Math.round((product.stock / (product.min * 2)) * 100)) : 100
              return (
                <article className="stockListItem" key={product.id} onClick={() => onProduct({ ...product, showKg: dupIds.has(product.id) && !!product.packagingWeight })}>
                  <div className="stockListInfo">
                    <span>{product.category}</span>
                    <h3>{product.name}{dupIds.has(product.id) && product.packagingWeight ? <small style={{fontWeight:400,marginLeft:6}}>{product.packagingWeight}kg</small> : null}</h3>
                    <p>{[product.group, product.description].filter(Boolean).join(' • ')}</p>
                  </div>
                  <div className="stockLevel stockListLevel"><div style={{ width: `${percent}%` }}></div></div>
                  <div className="stockMeta stockListMeta">
                    <b>{product.stock} Unidades</b>
                    <small>{product.min > 0 ? `Mínimo: ${product.min}` : 'Sem mínimo definido'}</small>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
      {newProductOpen && (
        <NewProductModal
          onClose={() => setNewProductOpen(false)}
          bgImport={bgImport}
          onStartBgAnalysis={onStartBgAnalysis}
          onClearBgImport={onClearBgImport}
          onCreated={(result) => {
            if (addNotif) {
              if (result?.isBatch) {
                addNotif('notifStock', { icon: Boxes, title: 'Produtos registrados via upload', text: `${result.count} produto(s) adicionados ao estoque via documento.` })
              } else {
                addNotif('notifStock', { icon: PackageCheck, title: 'Produto registrado', text: `${result?.name || 'Novo produto'} foi adicionado ao estoque.` })
              }
            }
            fetchProducts()
          }}
        />
      )}
    </>
  )
}

function Suppliers({ onMessage, search = '', addNotif }) {
  const [suppliersData, setSuppliersData] = useState([])
  const [loading, setLoading] = useState(false)
  const [scheduledCounts, setScheduledCounts] = useState({})
  const [newSupplierOpen, setNewSupplierOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState(null)
  const [detailSupplier, setDetailSupplier] = useState(null)
  const [transcript, setTranscript] = useState(null)
  const [removeConfirmSupplier, setRemoveConfirmSupplier] = useState(null)
  const notifiedTranscriptRef = useRef(new Set())

  useEffect(() => {
    setLoading(true)
    fetch(`${API_URL}/api/suppliers`)
      .then((r) => r.json())
      .then((data) => {
        if (data.suppliers) {
          setSuppliersData(data.suppliers)
          if (addNotif) {
            data.suppliers.forEach((s) => {
              const transcript = supplierTranscripts[s.id]
              if (transcript?.status === 'Concluída' && !notifiedTranscriptRef.current.has(s.id)) {
                const sessionKey = `notif_supplier_concluida_${s.id}`
                if (!sessionStorage.getItem(sessionKey)) {
                  addNotif('notifSuppliers', { icon: Bot, title: 'Conversa IA concluída', text: `A conversa da IA com ${s.name} foi concluída com sucesso.` })
                  sessionStorage.setItem(sessionKey, '1')
                  notifiedTranscriptRef.current.add(s.id)
                }
              }
            })
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    fetch(`${API_URL}/api/supplier-purchases`)
      .then((r) => r.json())
      .then((data) => {
        if (data.purchases) {
          const counts = {}
          data.purchases.forEach((p) => {
            if (p.status !== 'Concluída' && !p.completedAt) {
              counts[p.supplierId] = (counts[p.supplierId] || 0) + 1
            }
          })
          setScheduledCounts(counts)
        }
      })
      .catch(() => {})
  }, [])

  const addSupplier = (s) => setSuppliersData((prev) => [...prev, s])
  const updateSupplier = (s) => setSuppliersData((prev) => prev.map((x) => x.id === s.id ? s : x))
  const removeSupplier = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/suppliers`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Falha ao remover fornecedor')
    } catch {
      return
    }
    setSuppliersData((prev) => prev.filter((s) => s.id !== id))
    setRemoveConfirmSupplier(null)
    setNewSupplierOpen(false)
    setEditSupplier(null)
    setDetailSupplier(null)
  }

  const filtered = !search ? suppliersData : suppliersData.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <section className="pageStack">
      <div className="sectionHeader">
        <div><p>Relação com fornecedores de alimentos</p></div>
        <button className="btnSolid" onClick={() => { setEditSupplier(null); setNewSupplierOpen(true) }}>
          <Plus size={18} /> Novo fornecedor
        </button>
      </div>
      {loading && <p className="loadingText">Carregando fornecedores...</p>}
      {!loading && filtered.length === 0 && <p className="emptyText">Nenhum fornecedor cadastrado.</p>}
      <div className="supplierGrid">
        {filtered.map((supplier) => (
          <article className="supplierCard" key={supplier.id}>
            <div className="supplierIcon"><Factory size={24} /></div>
            <div className="supplierTop"><h3>{supplier.name}</h3><Status status="Ativo" /></div>
            <p>{supplier.foodTypes || '—'}</p>
            <div className="supplierInfo">
              <span>Contato: <b>{supplier.contactName || '—'}</b></span>
              <span>Prazo médio: <b>{supplier.leadTimeDays != null ? `${supplier.leadTimeDays} dia${supplier.leadTimeDays !== 1 ? 's' : ''}` : '—'}</b></span>
              <span>WhatsApp: <b>{supplier.contactPhone || '—'}</b></span>
            </div>
            <div className="supplierInfo">
              <span>Compras agendadas: <b>{scheduledCounts[supplier.id] ?? 0}</b></span>
            </div>
            <div className="orderActions">
              <button onClick={() => setTranscript(supplier)}>Ver conversa IA</button>
              <button onClick={() => setDetailSupplier(supplier)}>Detalhes</button>
              <button onClick={() => onMessage(supplier)}>Comunicar</button>
            </div>
          </article>
        ))}
      </div>
      {newSupplierOpen && (
        <NewSupplierModal
          onClose={() => { setNewSupplierOpen(false); setEditSupplier(null) }}
          onCreated={addSupplier}
          editSupplier={editSupplier}
          onUpdated={(s) => { updateSupplier(s); setDetailSupplier(s) }}
          onRemove={(supplier) => { setNewSupplierOpen(false); setRemoveConfirmSupplier(supplier) }}
        />
      )}
      {detailSupplier && (
        <SupplierDetailModal
          supplier={detailSupplier}
          onClose={() => setDetailSupplier(null)}
          onEdit={(s) => { setDetailSupplier(null); setEditSupplier(s); setNewSupplierOpen(true) }}
          onRemove={(s) => { setDetailSupplier(null); setRemoveConfirmSupplier(s) }}
        />
      )}
      {transcript && <SupplierTranscriptModal supplier={transcript} onClose={() => setTranscript(null)} />}
      {removeConfirmSupplier && (
        <div className="cancelSepOverlay" onClick={(e) => { if (e.target.classList.contains('cancelSepOverlay')) setRemoveConfirmSupplier(null) }}>
          <div className="cancelSepModal">
            <h3>Remover fornecedor?</h3>
            <p>O fornecedor <b>{removeConfirmSupplier.name}</b> será removido permanentemente do sistema.</p>
            <div className="cancelSepActions">
              <button className="cancelSepConfirm" style={{ background: 'var(--red)' }} onClick={() => removeSupplier(removeConfirmSupplier.id)}>Sim, remover fornecedor</button>
              <button className="cancelSepDeny" onClick={() => setRemoveConfirmSupplier(null)}>Não, voltar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function SupplierDetailModal({ supplier, onClose, onEdit, onRemove }) {
  const [purchases, setPurchases] = useState([])
  const [loadingPurchases, setLoadingPurchases] = useState(true)
  const [extractedPrices, setExtractedPrices] = useState({})
  const [pricesLoading, setPricesLoading] = useState(false)
  const [confirmRemovePurchase, setConfirmRemovePurchase] = useState(null)
  const [removingPurchase, setRemovingPurchase] = useState(false)

  const handleRemovePurchase = async (purchase) => {
    setRemovingPurchase(true)
    try {
      await fetch(`${API_URL}/api/supplier-purchases`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: purchase.id }),
      })
      // Also try to remove the corresponding planning item by title
      const planRes = await fetch(`${API_URL}/api/purchase-planning`)
      if (planRes.ok) {
        const planData = await planRes.json()
        const titlePattern = `Compra: ${purchase.purchaseName} com ${supplier.name}`.toLowerCase()
        const matching = (planData.items || []).find(
          (item) => item.title?.toLowerCase() === titlePattern && !item.completed
        )
        if (matching) {
          await fetch(`${API_URL}/api/purchase-planning`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: matching.id }),
          })
        }
      }
      setPurchases((prev) => prev.filter((p) => p.id !== purchase.id))
      setConfirmRemovePurchase(null)
    } catch {
      // silent
    } finally {
      setRemovingPurchase(false)
    }
  }

  useEffect(() => {
    setLoadingPurchases(true)
    fetch(`${API_URL}/api/supplier-purchases?supplierId=${supplier.id}`)
      .then((r) => r.json())
      .then((data) => { if (data.purchases) setPurchases(data.purchases) })
      .catch(() => {})
      .finally(() => setLoadingPurchases(false))
  }, [supplier.id])

  useEffect(() => {
    const scheduled = purchases.filter((p) => p.status !== 'Concluída' && !p.completedAt)
    if (scheduled.length === 0) return
    const transcript = supplierTranscripts[supplier.id]
    if (!transcript?.messages?.length) return

    let cancelled = false
    setPricesLoading(true)
    Promise.all(
      scheduled.map((p) =>
        fetch(`${API_URL}/api/extract-purchase-price`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: transcript.messages,
            productName: p.purchaseName,
            productType: supplier.foodTypes || '',
            quantity: String(p.quantity || ''),
            unit: p.notes || '',
          }),
        })
          .then((r) => r.json())
          .then((data) => ({ id: p.id, data }))
          .catch(() => ({ id: p.id, data: null }))
      )
    ).then((results) => {
      if (cancelled) return
      const map = {}
      results.forEach(({ id, data }) => { if (data) map[id] = data })
      setExtractedPrices(map)
    }).finally(() => { if (!cancelled) setPricesLoading(false) })

    return () => { cancelled = true }
  }, [purchases, supplier.id])

  const fmtDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const completed = purchases.filter((p) => p.status === 'Concluída' || p.completedAt)
  const scheduled = purchases.filter((p) => p.status !== 'Concluída' && !p.completedAt)

  const totalSpent = completed.reduce((sum, p) => sum + (p.totalAmount || 0), 0)

  return (
    <div className="modalBackdrop">
      <div className="detailModal newOrderModal supplierDetailModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>Fornecedor</span>
            <h2>{supplier.name}</h2>
            <p>Informações completas, histórico de compras e compras agendadas</p>
          </div>
        </div>
        <div className="newOrderScrollArea">
          <h3>Dados do fornecedor</h3>
          <div className="supplierDetailGrid">
            {supplier.foodTypes && <div className="supplierDetailItem"><span>Tipos de alimentos</span><b>{supplier.foodTypes}</b></div>}
            <div className="supplierDetailItem"><span>Contato</span><b>{supplier.contactName || '—'}</b></div>
            <div className="supplierDetailItem"><span>WhatsApp</span><b>{supplier.contactPhone || '—'}</b></div>
            <div className="supplierDetailItem"><span>Prazo médio</span><b>{supplier.leadTimeDays != null ? `${supplier.leadTimeDays} dia${supplier.leadTimeDays !== 1 ? 's' : ''}` : '—'}</b></div>
            {supplier.address && <div className="supplierDetailItem supplierDetailFull"><span><MapPin size={12} /> Endereço</span><b>{supplier.address}</b></div>}
          </div>

          <div className="supplierDetailDivider" />

          <div className="supplierDetailSectionHeader">
            <h3>Compras agendadas</h3>
            {scheduled.length > 0 && <span className="badge">{scheduled.length}</span>}
          </div>
          {loadingPurchases && <p className="loadingText" style={{ marginTop: 8 }}>Carregando...</p>}
          {!loadingPurchases && scheduled.length === 0 && (
            <p className="emptyText" style={{ marginTop: 8 }}>Nenhuma compra agendada.</p>
          )}
          {!loadingPurchases && scheduled.length > 0 && (
            <div className="purchaseHistoryList">
              {scheduled.map((p) => {
                const ep = extractedPrices[p.id]
                const priceNode = pricesLoading && !ep
                  ? <span>Valor: <b style={{ color: 'var(--muted)', fontWeight: 400 }}>Analisando conversa IA...</b></span>
                  : ep?.totalPrice
                    ? <span>Valor: <b>{money(ep.totalPrice)}{ep.unitPrice ? ` (unit. ${money(ep.unitPrice)})` : ''}</b></span>
                    : ep?.unitPrice
                      ? <span>Valor: <b>{money(ep.unitPrice)} / un.</b></span>
                      : null
                return (
                <div className="purchaseHistoryItem" key={p.id} style={{ position: 'relative' }}>
                  <button
                    className="purchaseHistoryRemoveBtn"
                    title="Remover pedido"
                    onClick={() => setConfirmRemovePurchase(p)}
                  ><X size={11} /></button>
                  <div className="purchaseHistoryMain">
                    <b>{p.purchaseName}</b>
                    {p.description && <span>{p.description}</span>}
                  </div>
                  <div className="purchaseHistoryMeta">
                    <span>Qtd: <b>{p.quantity}</b></span>
                    {priceNode}
                    {p.scheduledPurchaseDate && <span>Data: <b>{fmtDate(p.scheduledPurchaseDate)}</b></span>}
                    <span className="purchaseStatusBadge pending">{p.status}</span>
                  </div>
                  {p.notes && <p className="purchaseHistoryNotes">{p.notes}</p>}
                </div>
                )
              })}
            </div>
          )}

          <div className="supplierDetailDivider" />

          <div className="supplierDetailSectionHeader">
            <h3>Histórico de compras</h3>
            {completed.length > 0 && (
              <span className="supplierDetailTotal">Total gasto: <b>{money(totalSpent)}</b></span>
            )}
          </div>
          {loadingPurchases && <p className="loadingText" style={{ marginTop: 8 }}>Carregando...</p>}
          {!loadingPurchases && completed.length === 0 && (
            <p className="emptyText" style={{ marginTop: 8 }}>Nenhuma compra realizada.</p>
          )}
          {!loadingPurchases && completed.length > 0 && (
            <div className="purchaseHistoryList">
              {completed.map((p) => (
                <div className="purchaseHistoryItem" key={p.id}>
                  <div className="purchaseHistoryMain">
                    <b>{p.purchaseName}</b>
                    {p.description && <span>{p.description}</span>}
                  </div>
                  <div className="purchaseHistoryMeta">
                    <span>Qtd: <b>{p.quantity}</b></span>
                    {p.totalAmount != null && <span>Valor: <b>{money(p.totalAmount)}</b></span>}
                    {p.completedAt && <span>Concluída em: <b>{fmtDate(p.completedAt)}</b></span>}
                    <span className="purchaseStatusBadge done">Concluída</span>
                  </div>
                  {p.notes && <p className="purchaseHistoryNotes">{p.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="newOrderFooter">
          <div className="newOrderFooterActions" style={{ marginLeft: 'auto' }}>
            <button type="button" className="orderModalBtn orderModalBtnDanger" onClick={() => onRemove(supplier)}>Remover</button>
            <button type="button" className="btnPrimary" onClick={() => onEdit(supplier)}>
              <ClipboardEdit size={16} /> Editar
            </button>
          </div>
        </div>
        {confirmRemovePurchase && (
          <div className="cancelSepOverlay" onClick={(e) => { if (e.target.classList.contains('cancelSepOverlay')) setConfirmRemovePurchase(null) }}>
            <div className="cancelSepModal">
              <h3>Remover pedido?</h3>
              <p>O pedido <b>{confirmRemovePurchase.purchaseName}</b> será removido das compras agendadas deste fornecedor e do planejamento de compras.</p>
              <div className="cancelSepActions">
                <button className="cancelSepConfirm" style={{ background: 'var(--red)' }} disabled={removingPurchase} onClick={() => handleRemovePurchase(confirmRemovePurchase)}>
                  {removingPurchase ? 'Removendo...' : 'Sim, remover pedido'}
                </button>
                <button className="cancelSepDeny" onClick={() => setConfirmRemovePurchase(null)}>Não, voltar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NewSupplierModal({ onClose, onCreated, editSupplier, onUpdated, onRemove }) {
  const [form, setForm] = useState(() => editSupplier ? {
    name: editSupplier.name || '',
    foodTypes: editSupplier.foodTypes || '',
    contactName: editSupplier.contactName || '',
    contactPhone: editSupplier.contactPhone || '',
    address: editSupplier.address || '',
    leadTimeDays: editSupplier.leadTimeDays != null ? String(editSupplier.leadTimeDays) : '',
  } : { name: '', foodTypes: '', contactName: '', contactPhone: '', address: '', leadTimeDays: '' })
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const isDirty = editSupplier ? (
    form.name !== (editSupplier.name || '') ||
    form.foodTypes !== (editSupplier.foodTypes || '') ||
    form.contactName !== (editSupplier.contactName || '') ||
    form.contactPhone !== (editSupplier.contactPhone || '') ||
    form.address !== (editSupplier.address || '') ||
    form.leadTimeDays !== (editSupplier.leadTimeDays != null ? String(editSupplier.leadTimeDays) : '')
  ) : true

  const canSubmit = form.name.trim() !== '' && isDirty

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitError('')
    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        foodTypes: form.foodTypes || null,
        contactName: form.contactName || null,
        contactPhone: form.contactPhone || null,
        address: form.address || null,
        leadTimeDays: form.leadTimeDays !== '' ? parseInt(form.leadTimeDays, 10) : null,
      }
      if (editSupplier) {
        const res = await fetch(`${API_URL}/api/suppliers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editSupplier.id, ...payload }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar fornecedor')
        onUpdated({ ...editSupplier, ...payload })
        onClose()
      } else {
        const res = await fetch(`${API_URL}/api/suppliers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar fornecedor')
        onCreated(data.supplier)
        onClose()
      }
    } catch (err) {
      setSubmitError(err.message || 'Erro ao salvar fornecedor. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modalBackdrop">
      <div className="detailModal newOrderModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>{editSupplier ? 'Edição' : 'Cadastro'}</span>
            <h2>{editSupplier ? 'Editar fornecedor' : 'Novo fornecedor'}</h2>
            <p>{editSupplier ? 'Altere os dados do fornecedor e salve as modificações' : 'Preencha os dados para cadastrar o fornecedor no sistema'}</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <div className="newOrderScrollArea">
            <h3>Dados do fornecedor</h3>
            <div className="settingsForm">
              <label>Nome do fornecedor *
                <input placeholder="Ex: Queijos Serra Alta" value={form.name} onChange={(e) => set('name', e.target.value)} required />
              </label>
              <label>Tipos de alimentos
                <input placeholder="Ex: Laticínios, massas, frios" value={form.foodTypes} onChange={(e) => set('foodTypes', e.target.value)} />
              </label>
              <label>Nome do contato
                <input placeholder="Ex: Marcos" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
              </label>
              <label>WhatsApp / Número do contato
                <input placeholder="(49) 99910-1111" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
              </label>
              <label>Endereço
                <input placeholder="Ex: Rua das Flores, 123 – Lages, SC" value={form.address} onChange={(e) => set('address', e.target.value)} />
              </label>
              <label>Prazo médio (dias)
                <input type="number" min="0" placeholder="Ex: 2" value={form.leadTimeDays} onChange={(e) => set('leadTimeDays', e.target.value)} />
              </label>
            </div>
          </div>
          <div className="newOrderFooter">
            {submitError && <small className="errorText">{submitError}</small>}
            <div className="newOrderFooterActions" style={{ marginLeft: 'auto' }}>
              <button type="submit" className="btnPrimary" disabled={!canSubmit || submitting}>
                <CheckCircle2 size={17} /> {submitting ? (editSupplier ? 'Salvando...' : 'Cadastrando...') : (editSupplier ? 'Salvar alterações' : 'Cadastrar fornecedor')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function SendPurchaseModal({ suggestion, suppliers, onClose, notify, onConfirmed }) {
  const defaultTime = useMemo(() => {
    try { return localStorage.getItem('saborsan_purchase_default_time') || '09:00' } catch { return '09:00' }
  }, [])

  const bestSupplier = useMemo(() => {
    if (!suppliers.length) return null
    const byName = suppliers.find((s) => s.name.toLowerCase() === suggestion.supplier.toLowerCase())
    if (byName) return byName
    const byType = suppliers.find((s) =>
      s.foodTypes && s.foodTypes.toLowerCase().includes(suggestion.category.toLowerCase())
    )
    return byType || null
  }, [suppliers, suggestion])

  const [selectedSupplierId, setSelectedSupplierId] = useState(() => bestSupplier?.id || (suppliers[0]?.id ?? ''))
  const [customQty, setCustomQty] = useState(suggestion.qty)
  const [scheduleMode, setScheduleMode] = useState('default')
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().split('T')[0])
  const [customTime, setCustomTime] = useState('09:00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId)
  const scheduledDate = scheduleMode === 'custom' ? customDate : new Date().toISOString().split('T')[0]
  const scheduledTime = scheduleMode === 'custom' ? customTime : defaultTime
  const unitPrice = suggestion.qty > 0 && suggestion.value > 0 ? suggestion.value / suggestion.qty : 0
  const adjustedValue = unitPrice > 0 ? unitPrice * customQty : 0

  const submit = async () => {
    if (!selectedSupplierId) { setError('Selecione um fornecedor.'); return }
    setError('')
    setSubmitting(true)
    try {
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`)

      const purchaseRes = await fetch(`${API_URL}/api/supplier-purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          purchaseName: suggestion.item,
          description: suggestion.reason,
          quantity: customQty,
          totalAmount: adjustedValue,
          scheduledPurchaseDate: scheduledDateTime.toISOString(),
          status: 'pending',
          notes: `${customQty} ${suggestion.unit}`,
        }),
      })
      const purchaseData = await purchaseRes.json()
      if (!purchaseRes.ok) throw new Error(purchaseData.error || 'Erro ao registrar compra no fornecedor.')

      const planningTitle = `Compra: ${suggestion.item} com ${selectedSupplier?.name || suggestion.supplier}`
      const planningRes = await fetch(`${API_URL}/api/purchase-planning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: planningTitle,
          scheduledDate,
          notes: `${customQty} ${suggestion.unit} — ${adjustedValue > 0 ? money(adjustedValue) : ''}`.trimEnd(),
        }),
      })
      const planningData = await planningRes.json()
      if (!planningRes.ok) throw new Error(planningData.error || 'Erro ao agendar no planejamento.')

      notify(`Compra de ${customQty} ${suggestion.unit} de ${suggestion.item} registrada para ${selectedSupplier?.name || suggestion.supplier}.`)
      onConfirmed(planningData.item, null, suggestion.id)
      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao confirmar compra.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modalBackdrop">
      <div className="detailModal newOrderModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>Compras</span>
            <h2>Enviar para fornecedor</h2>
            <p>Confirme o fornecedor e o agendamento desta compra</p>
          </div>
        </div>
        <div className="newOrderScrollArea">
          <h3>Produto solicitado</h3>
          <div className="supplierDetailGrid">
            <div className="supplierDetailItem"><span>Item</span><b>{suggestion.item}</b></div>
            <div className="supplierDetailItem">
              <span>Quantidade</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={customQty}
                  onChange={(e) => setCustomQty(Math.max(1, Number(e.target.value) || 1))}
                  style={{ width: 80, fontWeight: 700, fontSize: '.95rem', padding: '4px 8px', borderRadius: 8, border: '1.5px solid var(--border)', textAlign: 'center' }}
                />
                <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{suggestion.unit}</span>
              </div>
            </div>
            <div className="supplierDetailItem"><span>Valor estimado</span><b>{adjustedValue > 0 ? money(adjustedValue) : '—'}</b></div>
            <div className="supplierDetailItem supplierDetailFull"><span>Motivo da sugestão</span><b>{suggestion.reason}</b></div>
          </div>

          <h3 className="newOrderSectionTitle">Fornecedor</h3>
          {bestSupplier && (
            <div
              className={`sendPurchaseSuggested${selectedSupplierId === bestSupplier.id ? ' selected' : ''}`}
              onClick={() => setSelectedSupplierId(bestSupplier.id)}
            >
              <b><Sparkles size={13} style={{ color: 'var(--orange)', verticalAlign: 'middle', marginRight: 5 }} />Sugerido: {bestSupplier.name}</b>
              <p>{bestSupplier.foodTypes || '—'} &bull; Contato: {bestSupplier.contactName || '—'} &bull; Prazo: {bestSupplier.leadTimeDays != null ? `${bestSupplier.leadTimeDays} dia(s)` : '—'}</p>
            </div>
          )}
          <div className="settingsForm" style={{ marginTop: 10 }}>
            <label>Selecionar fornecedor
              <select value={selectedSupplierId || ''} onChange={(e) => setSelectedSupplierId(Number(e.target.value))}>
                <option value="">Selecione...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.id === bestSupplier?.id ? ' ★ Sugerido' : ''}</option>
                ))}
              </select>
            </label>
          </div>

          <h3 className="newOrderSectionTitle">Agendamento</h3>
          <div className="iaModeSelector">
            <button type="button" className={`iaModeBtn${scheduleMode === 'default' ? ' active' : ''}`} onClick={() => setScheduleMode('default')}>
              <Clock3 size={18} />
              <div><b>Horário padrão</b><small>Hoje, às {defaultTime} — conforme configurações</small></div>
            </button>
            <button type="button" className={`iaModeBtn${scheduleMode === 'custom' ? ' active' : ''}`} onClick={() => setScheduleMode('custom')}>
              <CalendarDays size={18} />
              <div><b>Data e hora personalizadas</b><small>Escolha quando realizar esta compra</small></div>
            </button>
          </div>
          {scheduleMode === 'custom' && (
            <div className="settingsForm settingsTwoCols" style={{ marginTop: 12 }}>
              <label>Data<input type="date" value={customDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setCustomDate(e.target.value)} /></label>
              <label>Horário<input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} /></label>
            </div>
          )}

          {error && <small className="errorText" style={{ marginTop: 12, display: 'block' }}>{error}</small>}
        </div>
        <div className="newOrderFooter">
          <div className="newOrderFooterActions" style={{ marginLeft: 'auto' }}>
            <button type="button" onClick={onClose}>Cancelar</button>
            <button type="button" className="btnPrimary" disabled={!selectedSupplierId || submitting} onClick={submit}>
              <CheckCircle2 size={17} /> {submitting ? 'Confirmando...' : 'Confirmar compra'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NewPurchaseModal({ suppliers, onClose, notify, onConfirmed, editItem = null }) {
  const defaultTime = '08:00'
  const [form, setForm] = useState(() => {
    if (!editItem) return { purchaseName: '', supplierId: '', quantity: '', unit: '', totalAmount: '', notes: '' }
    let purchaseName = editItem.title || ''
    let supplierName = ''
    const titleMatch = editItem.title?.match(/^Compra:\s*(.+?)\s+com\s+(.+)$/)
    if (titleMatch) { purchaseName = titleMatch[1]; supplierName = titleMatch[2] }
    let quantity = ''
    let unit = ''
    let totalAmount = ''
    if (editItem.notes) {
      const parts = editItem.notes.split(' — ')
      const m = parts[0].trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
      if (m) { quantity = m[1]; unit = m[2].trim() }
      if (parts[1]) {
        const v = parseFloat(parts[1].replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.'))
        if (!isNaN(v)) totalAmount = String(v)
      }
    }
    const sup = suppliers.find((s) => s.name === supplierName)
    return { purchaseName, supplierId: sup ? String(sup.id) : '', quantity, unit, totalAmount, notes: '' }
  })
  const [scheduleMode, setScheduleMode] = useState(editItem ? 'custom' : 'default')
  const [customDate, setCustomDate] = useState(editItem?.scheduledDate || new Date().toISOString().split('T')[0])
  const [customTime, setCustomTime] = useState(defaultTime)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const initialFormRef = useRef(null)
  const initialScheduleModeRef = useRef(editItem ? 'custom' : 'default')
  const initialCustomDateRef = useRef(editItem?.scheduledDate || new Date().toISOString().split('T')[0])
  const initialCustomTimeRef = useRef(defaultTime)
  if (initialFormRef.current === null) initialFormRef.current = { ...form }

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const scheduledDate = scheduleMode === 'custom' ? customDate : new Date().toISOString().split('T')[0]
  const scheduledTime = scheduleMode === 'custom' ? customTime : defaultTime

  const isEdited = !editItem || (
    form.purchaseName !== initialFormRef.current.purchaseName ||
    form.supplierId !== initialFormRef.current.supplierId ||
    form.quantity !== initialFormRef.current.quantity ||
    form.unit !== initialFormRef.current.unit ||
    form.totalAmount !== initialFormRef.current.totalAmount ||
    form.notes !== initialFormRef.current.notes ||
    scheduleMode !== initialScheduleModeRef.current ||
    customDate !== initialCustomDateRef.current ||
    customTime !== initialCustomTimeRef.current
  )

  const canSubmit = form.purchaseName.trim() !== '' && form.supplierId !== '' && form.quantity !== '' && isEdited

  const submit = async () => {
    if (!canSubmit) { setError('Preencha os campos obrigatórios.'); return }
    setError('')
    setSubmitting(true)
    try {
      const selectedSupplier = suppliers.find((s) => s.id === Number(form.supplierId))
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`)
      const totalVal = form.totalAmount !== '' ? parseFloat(form.totalAmount) : null
      const planningTitle = `Compra: ${form.purchaseName.trim()} com ${selectedSupplier?.name || 'Fornecedor'}`
      const planningNotes = `${form.quantity} ${form.unit}${totalVal ? ` — ${money(totalVal)}` : ''}`.trim()

      if (editItem) {
        const planningRes = await fetch(`${API_URL}/api/purchase-planning`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editItem.id, title: planningTitle, scheduledDate, notes: planningNotes }),
        })
        const planningData = await planningRes.json()
        if (!planningRes.ok) throw new Error(planningData.error || 'Erro ao atualizar compra.')
        notify(`Compra de ${form.purchaseName.trim()} atualizada.`)
        onConfirmed(planningData.item, editItem.id)
        onClose()
        return
      }

      const purchaseRes = await fetch(`${API_URL}/api/supplier-purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: Number(form.supplierId),
          purchaseName: form.purchaseName.trim(),
          description: form.notes.trim() || null,
          quantity: parseFloat(form.quantity),
          totalAmount: totalVal,
          scheduledPurchaseDate: scheduledDateTime.toISOString(),
          status: 'pending',
          notes: form.unit.trim() || null,
        }),
      })
      const purchaseData = await purchaseRes.json()
      if (!purchaseRes.ok) throw new Error(purchaseData.error || 'Erro ao registrar compra.')

      const planningRes = await fetch(`${API_URL}/api/purchase-planning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: planningTitle, scheduledDate, notes: planningNotes }),
      })
      const planningData = await planningRes.json()
      if (!planningRes.ok) throw new Error(planningData.error || 'Erro ao agendar no planejamento.')

      notify(`Compra de ${form.purchaseName.trim()} registrada para ${selectedSupplier?.name || 'fornecedor'}.`)
      onConfirmed(planningData.item, null)
      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao confirmar compra.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modalBackdrop">
      <div className="detailModal newOrderModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>Compras</span>
            <h2>{editItem ? 'Editar compra' : 'Nova compra'}</h2>
            <p>{editItem ? 'Atualize os dados da compra agendada' : 'Registre uma nova compra com fornecedor e agendamento'}</p>
          </div>
        </div>
        <div className="newOrderScrollArea">
          <h3>Dados da compra</h3>
          <div className="settingsForm">
            <label>Item / Produto *
              <input placeholder="Ex: Açaí Premium Balde" value={form.purchaseName} onChange={(e) => set('purchaseName', e.target.value)} />
            </label>
            <label>Quantidade *
              <input type="number" min="0.01" step="0.01" placeholder="Ex: 24" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
            </label>
            <label>Unidade
              <input placeholder="Ex: baldes, caixas, kg" value={form.unit} onChange={(e) => set('unit', e.target.value)} />
            </label>
          </div>

          <h3 className="newOrderSectionTitle">Fornecedor *</h3>
          <div className="settingsForm">
            <label>Selecionar fornecedor
              <CustomSelect
                value={form.supplierId}
                onChange={(v) => set('supplierId', v)}
                placeholder="Selecione..."
                options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
              />
            </label>
          </div>

          <h3 className="newOrderSectionTitle">Agendamento</h3>
          <div className="iaModeSelector">
            <button type="button" className={`iaModeBtn${scheduleMode === 'default' ? ' active' : ''}`} onClick={() => setScheduleMode('default')}>
              <Clock3 size={18} />
              <div><b>Horário padrão</b><small>Hoje, às {defaultTime} — conforme configurações</small></div>
            </button>
            <button type="button" className={`iaModeBtn${scheduleMode === 'custom' ? ' active' : ''}`} onClick={() => setScheduleMode('custom')}>
              <CalendarDays size={18} />
              <div><b>Data e hora personalizadas</b><small>Escolha quando realizar esta compra</small></div>
            </button>
          </div>
          {scheduleMode === 'custom' && (
            <div className="settingsForm settingsTwoCols" style={{ marginTop: 12 }}>
              <label>Data<input type="date" value={customDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setCustomDate(e.target.value)} /></label>
              <label>Horário<input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} /></label>
            </div>
          )}

          <h3 className="newOrderSectionTitle">Observações</h3>
          <div className="noteBox">
            <textarea rows={3} placeholder="Detalhes adicionais, motivo da compra..." value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          {error && <small className="errorText" style={{ marginTop: 12, display: 'block' }}>{error}</small>}
        </div>
        <div className="newOrderFooter">
          <div className="newOrderFooterActions" style={{ marginLeft: 'auto' }}>
            <button type="button" onClick={onClose}>Cancelar</button>
            <button type="button" className="btnPrimary" disabled={!canSubmit || submitting} onClick={submit}>
              <CheckCircle2 size={17} /> {submitting ? (editItem ? 'Atualizando...' : 'Registrando...') : (editItem ? 'Salvar alterações' : 'Registrar compra')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PurchaseDetailModal({ item, getDayLabel, onClose, onRemove, onEdit, suppliers = [] }) {
  let itemName = item.title || ''
  let supplierName = ''
  const titleMatch = item.title?.match(/^Compra:\s*(.+?)\s+com\s+(.+)$/)
  if (titleMatch) { itemName = titleMatch[1]; supplierName = titleMatch[2] }

  let qtyUnit = ''
  if (item.notes) {
    const parts = item.notes.split(' — ')
    qtyUnit = parts[0].trim()
  }

  const dateLabel = getDayLabel(item.scheduledDate)
  const fullDate = new Date(item.scheduledDate + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })

  const [lastPrice, setLastPrice] = useState(null)
  const [priceLoading, setPriceLoading] = useState(false)

  useEffect(() => {
    const supplier = suppliers.find((s) => s.name === supplierName)
    if (!supplier) return
    const transcript = supplierTranscripts[supplier.id]
    if (!transcript || !transcript.messages?.length) return

    let cancelled = false
    setPriceLoading(true)
    fetch(`${API_URL}/api/extract-purchase-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: transcript.messages,
        productName: itemName,
        productType: supplier.foodTypes || '',
        quantity: qtyUnit.replace(/[^\d.,]/g, '') || '',
        unit: qtyUnit.replace(/^[\d.,\s]+/, '').trim(),
      }),
    })
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setLastPrice(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPriceLoading(false) })

    return () => { cancelled = true }
  }, [item.id])

  return (
    <div className="modalBackdrop">
      <div className="detailModal newOrderModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>Compras</span>
            <h2>Detalhes da compra</h2>
            <p>Informações sobre a compra agendada</p>
          </div>
        </div>
        <div className="newOrderScrollArea">
          <div className="supplierDetailGrid">
            <div className="supplierDetailItem"><span>Item / Produto</span><b>{itemName}</b></div>
            {supplierName && <div className="supplierDetailItem"><span>Fornecedor</span><b>{supplierName}</b></div>}
            {qtyUnit && <div className="supplierDetailItem"><span>Quantidade</span><b>{qtyUnit}</b></div>}
            <div className="supplierDetailItem">
              <span>Último valor cobrado</span>
              {priceLoading
                ? <b style={{ color: 'var(--muted)', fontWeight: 400 }}>Analisando conversa IA...</b>
                : lastPrice?.totalPrice
                  ? <b>{money(lastPrice.totalPrice)}{lastPrice.unitPrice ? ` (unit. ${money(lastPrice.unitPrice)})` : ''}</b>
                  : lastPrice?.unitPrice
                    ? <b>{money(lastPrice.unitPrice)} / unidade</b>
                    : <b style={{ color: 'var(--muted)', fontWeight: 400 }}>Não informado na conversa</b>
              }
            </div>
            <div className="supplierDetailItem supplierDetailFull"><span>Data agendada</span><b>{dateLabel} — {fullDate}</b></div>
          </div>
        </div>
        <div className="newOrderFooter">
          <div className="newOrderFooterActions" style={{ marginLeft: 'auto' }}>
            <button type="button" className="orderModalBtnDanger" onClick={() => onRemove(item.id)}>
              <X size={17} /> Remover
            </button>
            <button type="button" className="btnPrimary" onClick={() => onEdit(item)}>
              <ClipboardEdit size={17} /> Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Purchases({ notify, addNotif }) {
  const [planningItems, setPlanningItems] = useState([])
  const [planningLoading, setPlanningLoading] = useState(true)
  const [suppliersData, setSuppliersData] = useState([])
  const [stockProducts, setStockProducts] = useState([])
  const [sendModal, setSendModal] = useState(null)
  const [sentIds, setSentIds] = useState(new Set())
  const [supplierPurchases, setSupplierPurchases] = useState([])
  const [newPurchaseModal, setNewPurchaseModal] = useState(false)
  const [detailModal, setDetailModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const notifiedPurchaseDueRef = useRef(new Set())

  useEffect(() => {
    setPlanningLoading(true)
    fetch(`${API_URL}/api/purchase-planning`)
      .then((r) => r.json())
      .then((data) => {
        if (data.items) {
          setPlanningItems(data.items)
          if (addNotif) {
            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 1)
            const tomorrowStr = tomorrow.toDateString()
            data.items.filter((item) => !item.completed).forEach((item) => {
              try {
                const d = new Date(item.scheduledDate + 'T00:00:00')
                if (d.toDateString() === tomorrowStr && !notifiedPurchaseDueRef.current.has(item.id)) {
                  const sessionKey = `notif_purchase_due_${item.id}`
                  if (!sessionStorage.getItem(sessionKey)) {
                    addNotif('notifPurchases', { icon: CalendarDays, title: 'Compra agendada para amanhã', text: `${item.title} está agendada para amanhã.` })
                    sessionStorage.setItem(sessionKey, '1')
                    notifiedPurchaseDueRef.current.add(item.id)
                  }
                }
              } catch {}
            })
          }
        }
      })
      .catch(() => {})
      .finally(() => setPlanningLoading(false))

    fetch(`${API_URL}/api/suppliers`)
      .then((r) => r.json())
      .then((data) => { if (data.suppliers) setSuppliersData(data.suppliers) })
      .catch(() => {})

    fetch(`${API_URL}/api/products`)
      .then((r) => r.json())
      .then((data) => { if (data.products) setStockProducts(data.products) })
      .catch(() => {})

    fetch(`${API_URL}/api/supplier-purchases`)
      .then((r) => r.json())
      .then((data) => { if (data.purchases) setSupplierPurchases(data.purchases) })
      .catch(() => {})
  }, [])

  const purchaseSuggestions = useMemo(() => {
    return stockProducts
      .filter((p) => {
        if (p.stock === 0) return true
        if (p.min > 0) {
          const pct = p.stock / (p.min * 2)
          return pct <= 0.1
        }
        return false
      })
      .map((p) => {
        const isZero = p.stock === 0
        const suggestedQty = p.min > 0 ? Math.max(p.min * 2 - p.stock, 1) : 10
        return {
          id: p.id,
          item: p.name,
          category: p.category,
          supplier: suppliersData.find((s) => s.category === p.category)?.name || '—',
          qty: suggestedQty,
          unit: p.unit || 'unidades',
          reason: isZero
            ? 'Estoque zerado — reposição urgente'
            : `Estoque crítico: ${p.stock} ${p.unit || 'unidades'} restantes (abaixo de 10%)`,
          value: p.price > 0 ? p.price * suggestedQty : 0,
        }
      })
  }, [stockProducts, suppliersData])

  const getDayLabel = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    if (date.toDateString() === today.toDateString()) return 'Hoje'
    if (date.toDateString() === tomorrow.toDateString()) return 'Amanhã'
    const fullDays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    const diffMs = date - new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays > 0 && diffDays < 7) return fullDays[date.getDay()]
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  const completePlanningItem = (id) => {
    fetch(`${API_URL}/api/purchase-planning`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, completed: true }),
    }).catch(() => {})
    setPlanningItems((prev) => prev.map((item) => item.id === id ? { ...item, completed: true } : item))
  }

  const removePlanningItem = (id) => {
    fetch(`${API_URL}/api/purchase-planning`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
    setPlanningItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSendConfirmed = (newItem, replacedId = null, sentSuggestionId = null) => {
    if (sentSuggestionId != null) {
      setSentIds((prev) => new Set([...prev, sentSuggestionId]))
    }
    if (newItem) {
      if (replacedId != null) {
        setPlanningItems((prev) =>
          prev.map((item) => item.id === replacedId ? newItem : item)
            .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
        )
      } else {
        setPlanningItems((prev) =>
          [...prev, newItem].sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
        )
        if (addNotif) {
          addNotif('notifPurchases', { icon: ClipboardList, title: 'Compra adicionada ao planejamento', text: `${newItem.title} foi adicionada à lista de compras.` })
        }
      }
    }
  }

  const activeItems = planningItems.filter((item) => !item.completed)

  const pendingStatusLabel = (status) => {
    const map = { pending: 'Pendente', 'in-progress': 'Em andamento', confirmed: 'Confirmado', processing: 'Em processamento' }
    return map[status?.toLowerCase()] || status || 'Pendente'
  }

  const getExistingPurchaseStatus = (itemName) => {
    const match = supplierPurchases.find(
      (p) => p.purchaseName?.toLowerCase() === itemName?.toLowerCase() &&
             p.status?.toLowerCase() !== 'concluída' &&
             p.status?.toLowerCase() !== 'concluida' &&
             !p.completedAt
    )
    return match ? match.status : null
  }

  return (
    <section className="pageStack">
      <div className="sectionHeader"><div><p>Compras, reposição e cotação</p></div><button className="btnSolid" onClick={() => setNewPurchaseModal(true)}><Plus size={18} /> Nova compra</button></div>
      <div className="contentGrid twoCols">
        <div className="card wideList">
          <div className="cardHeader"><div><p>Lista sugerida</p><h3>Reposições prioritárias</h3></div><ClipboardList /></div>
          {purchaseSuggestions.length === 0 && (
            <p className="emptyText" style={{ fontSize: '.85rem', margin: '8px 0' }}>Nenhuma reposição necessária no momento.</p>
          )}
          {purchaseSuggestions.map((item) => {
            const existingStatus = getExistingPurchaseStatus(item.item)
            const isSent = sentIds.has(item.id)
            return (
              <div className="purchaseLine" key={item.id}>
                <div><b>{item.item}</b><span>{item.reason}</span><small>{item.supplier}</small></div>
                <strong>{item.qty} {item.unit}</strong>
                <em>{item.value > 0 ? money(item.value) : '—'}</em>
                {isSent || existingStatus
                  ? <span className="purchaseSentBadge"><CheckCircle2 size={14} /> {isSent ? 'Enviado' : pendingStatusLabel(existingStatus)}</span>
                  : <button onClick={() => setSendModal(item)}>Enviar</button>}
              </div>
            )
          })}
        </div>
        <div className="card automationCard">
          <div className="cardHeader"><div><p>Planejamento</p><h3>Próximas compras</h3></div><CalendarDays /></div>
          <div className="calendarList">
            {planningLoading && <p className="loadingText" style={{ fontSize: '.85rem', margin: 0 }}>Carregando...</p>}
            {!planningLoading && activeItems.length === 0 && (
              <p className="emptyText" style={{ fontSize: '.85rem', margin: 0 }}>Nenhuma compra agendada.</p>
            )}
            {activeItems.map((item) => (
              <div key={item.id} className="calendarItemRow">
                <div>
                  <b>{getDayLabel(item.scheduledDate)}</b>
                  <span>{item.title}</span>
                </div>
                <div className="calendarItemActions">
                  <button className="calendarDetailBtn" onClick={() => setDetailModal(item)}>Detalhes</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {sendModal && (
        <SendPurchaseModal
          suggestion={sendModal}
          suppliers={suppliersData}
          onClose={() => setSendModal(null)}
          notify={notify}
          onConfirmed={handleSendConfirmed}
        />
      )}
      {newPurchaseModal && (
        <NewPurchaseModal
          suppliers={suppliersData}
          onClose={() => setNewPurchaseModal(false)}
          notify={notify}
          onConfirmed={handleSendConfirmed}
        />
      )}
      {detailModal && (
        <PurchaseDetailModal
          item={detailModal}
          getDayLabel={getDayLabel}
          onClose={() => setDetailModal(null)}
          onRemove={(id) => { removePlanningItem(id); setDetailModal(null) }}
          onEdit={(item) => { setDetailModal(null); setEditModal(item) }}
          suppliers={suppliersData}
        />
      )}
      {editModal && (
        <NewPurchaseModal
          suppliers={suppliersData}
          onClose={() => setEditModal(null)}
          notify={notify}
          onConfirmed={handleSendConfirmed}
          editItem={editModal}
        />
      )}
    </section>
  )
}

function Deliveries({ onNewDelivery, onSelect, deliveries: list, onOpenVehicles }) {
  const [view, setView] = useState('ativas')
  const driversWithActiveDelivery = new Set(
    list.filter((d) => !['Concluída', 'Cancelada'].includes(d.status)).map((d) => d.driver)
  )
  // Only the most recent completed delivery per driver (last in array) stays in "ativas"
  const latestCompletedIdByDriver = new Map()
  list.forEach((d) => {
    if (d.status === 'Concluída' && !driversWithActiveDelivery.has(d.driver)) {
      latestCompletedIdByDriver.set(d.driver, d.id)
    }
  })
  const filtered = view === 'ativas'
    ? list.filter((d) => {
        if (d.status === 'Cancelada') return false
        if (d.status === 'Concluída') return latestCompletedIdByDriver.get(d.driver) === d.id
        return true
      })
    : list.filter((d) => {
        if (d.status === 'Cancelada') return true
        if (d.status === 'Concluída') return driversWithActiveDelivery.has(d.driver) || latestCompletedIdByDriver.get(d.driver) !== d.id
        return false
      })
  return (
    <section className="pageStack">
      <div className="sectionHeader stockSectionHeader"><div><p>Rotas, motoristas e temperatura</p></div><div className="viewFilterWrap"><div className="deliverySegmented"><button className={`deliverySegBtn${view === 'ativas' ? ' active' : ''}`} onClick={() => setView('ativas')}>Entregas ativas</button><button className={`deliverySegBtn${view === 'historico' ? ' active' : ''}`} onClick={() => setView('historico')}>Histórico de entregas</button></div></div><div style={{display:'flex',gap:'8px'}}><button className="btnSolid" onClick={onNewDelivery}><Plus size={18} /> Nova entrega</button><button className="btnSolid" onClick={onOpenVehicles}><Truck size={18} /> Veículos</button></div></div>
      <div className="deliveryGrid">
        {filtered.map((delivery) => (
          <article className="deliveryCard" key={delivery.id} onClick={() => onSelect(delivery)} style={{cursor:'pointer'}}>
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

const SC_CITIES = [
  'Abelardo Luz','Agrolândia','Agronômica','Água Doce','Águas de Chapecó','Águas Frias','Águas Mornas','Alfredo Wagner','Alto Bela Vista',
  'Anchieta','Angelina','Anita Garibaldi','Anitápolis','Antônio Carlos','Apiúna','Arabutã','Araquari','Armazém','Arroio Trinta','Arvoredo',
  'Ascurra','Atalanta','Aurora','Balneário Arroio do Silva','Balneário Barra do Sul','Balneário Camboriú','Balneário Gaivota',
  'Balneário Piçarras','Balneário Rincão','Bandeirante','Barra Bonita','Barra Velha','Bela Vista do Toldo','Belmonte','Benedito Novo',
  'Biguaçu','Blumenau','Bocaina do Sul','Bom Jardim da Serra','Bom Jesus','Bom Jesus do Oeste','Bom Retiro','Bombinhas','Botuverá',
  'Braço do Norte','Braço do Trombudo','Brunópolis','Brusque','Caçador','Caibi','Calmon','Camboriú','Campo Alegre','Campo Belo do Sul',
  'Campo Erê','Campos Novos','Canelinha','Canoinhas','Capão Alto','Capinzal','Capivari de Baixo','Catanduvas','Caxambu do Sul',
  'Celso Ramos','Cerro Negro','Chapadão do Lageado','Chapecó','Cocal do Sul','Concórdia','Cordilheira Alta','Coronel Freitas',
  'Coronel Martins','Correia Pinto','Corupá','Criciúma','Cunha Porã','Cunhataí','Curitibanos','Descanso','Dionísio Cerqueira',
  'Dona Emma','Doutor Pedrinho','Entre Rios','Ermo','Erval Velho','Faxinal dos Guedes','Flor do Sertão','Florianópolis',
  'Formosa do Sul','Forquilhinha','Fraiburgo','Frei Rogério','Galvão','Garopaba','Garuva','Gaspar','Governador Celso Ramos',
  'Grão Pará','Gravatal','Guabiruba','Guaraciaba','Guaramirim','Guarujá do Sul','Guatambú','Herval d\'Oeste','Ibiam','Ibicaré',
  'Ibirama','Içara','Ilhota','Imaruí','Imbituba','Imbuia','Indaial','Iomerê','Ipira','Iporã do Oeste','Ipuaçu','Ipumirim',
  'Iraceminha','Irani','Irati','Irineópolis','Itá','Itaiópolis','Itajaí','Itapema','Itapiranga','Itapoá','Ituporanga','Jaborá',
  'Jacinto Machado','Jaguaruna','Jaraguá do Sul','Jardinópolis','Joaçaba','Joinville','José Boiteux','Jupiá','Lacerdópolis',
  'Lages','Laguna','Lajeado Grande','Laurentino','Lauro Müller','Lebon Régis','Leoberto Leal','Lindóia do Sul','Lontras',
  'Luiz Alves','Luzerna','Macieira','Mafra','Major Gercino','Major Vieira','Maracajá','Maravilha','Marema','Massaranduba',
  'Matos Costa','Meleiro','Mirim Doce','Modelo','Mondaí','Monte Carlo','Monte Castelo','Morro da Fumaça','Morro Grande',
  'Navegantes','Nova Erechim','Nova Itaberaba','Nova Trento','Nova Veneza','Novo Horizonte','Orleans','Otacílio Costa','Ouro',
  'Ouro Verde','Paial','Painel','Palhoça','Palma Sola','Palmeira','Palmitos','Papanduva','Paraíso','Passo de Torres',
  'Passos Maia','Paulo Lopes','Pedras Grandes','Penha','Peritiba','Pescaria Brava','Petrolândia','Pinhalzinho','Pinheiro Preto',
  'Piratuba','Planalto Alegre','Pomerode','Ponte Alta','Ponte Alta do Norte','Ponte Serrada','Porto Belo','Porto União',
  'Pouso Redondo','Praia Grande','Presidente Castelo Branco','Presidente Getúlio','Presidente Nereu','Princesa','Quilombo',
  'Rancho Queimado','Rio das Antas','Rio do Campo','Rio do Oeste','Rio do Sul','Rio dos Cedros','Rio Fortuna','Rio Negrinho',
  'Rio Rufino','Riqueza','Rodeio','Romelândia','Salete','Saltinho','Salto Veloso','Sangão','Santa Cecília','Santa Helena',
  'Santa Rosa de Lima','Santa Rosa do Sul','Santa Terezinha','Santa Terezinha do Progresso','Santiago do Sul',
  'Santo Amaro da Imperatriz','São Bento do Sul','São Bernardino','São Carlos','São Cristóvão do Sul','São Domingos',
  'São Francisco do Sul','São João Batista','São João do Itaperiú','São João do Oeste','São João do Sul','São Joaquim',
  'São José','São José do Cedro','São José do Cerrito','São Lourenço do Oeste','São Ludgero','São Marcos',
  'São Miguel da Boa Vista','São Miguel do Oeste','São Pedro de Alcântara','Saudades','Schroeder','Seara','Serra Alta',
  'Siderópolis','Sombrio','Sul Brasil','Taió','Tangará','Tigrinhos','Tijucas','Timbé do Sul','Timbó','Timbó Grande',
  'Três Barras','Treviso','Treze de Maio','Treze Tílias','Trombudo Central','Tubarão','Tunápolis','Turvo','União do Oeste',
  'Urubici','Urupema','Urussanga','Vargeão','Vargem','Vargem Bonita','Vidal Ramos','Videira','Vitor Meireles','Witmarsum',
  'Xanxerê','Xavantina','Xaxim','Zortéa',
]

const VEHICLES = [
  'Câmara fria 01',
  'Câmara fria 02',
  'Câmara fria 03',
  'Van refrigerada 01',
  'Van refrigerada 02',
  'Baú refrigerado 01',
  'Baú refrigerado 02',
]

function VehicleFormModal({ editVehicle, onClose, onSave }) {
  const [form, setForm] = useState({
    name: editVehicle?.name || '',
    brand: editVehicle?.brand || '',
    year: editVehicle?.year || '',
    plate: editVehicle?.plate || '',
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const hasChanges = !editVehicle || (
    form.name !== (editVehicle.name || '') ||
    form.brand !== (editVehicle.brand || '') ||
    String(form.year) !== String(editVehicle.year || '') ||
    form.plate !== (editVehicle.plate || '')
  )
  const canSubmit = form.name.trim() !== '' && hasChanges

  const submit = (e) => {
    e.preventDefault()
    if (!canSubmit) return
    onSave(editVehicle ? { ...editVehicle, ...form } : { id: Date.now(), ...form })
  }

  return (
    <div className="modalBackdrop">
      <div className="detailModal newOrderModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>Frota</span>
            <h2>{editVehicle ? 'Editar veículo' : 'Novo veículo'}</h2>
            <p>{editVehicle ? 'Altere as informações do veículo' : 'Preencha as informações do novo veículo'}</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <div className="newOrderScrollArea">
            <div className="settingsForm">
              <label>Nome do veículo *
                <input placeholder="Ex: Câmara fria 01" value={form.name} onChange={(e) => set('name', e.target.value)} required />
              </label>
              <label>Marca
                <input placeholder="Ex: Mercedes-Benz" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
              </label>
              <label>Ano
                <input type="number" min="1990" max="2030" placeholder="Ex: 2022" value={form.year} onChange={(e) => set('year', e.target.value)} />
              </label>
              <label>Placa
                <input placeholder="Ex: ABC-1234" value={form.plate} onChange={(e) => set('plate', e.target.value.toUpperCase())} />
              </label>
            </div>
          </div>
          <div className="newOrderFooter">
            <div className="newOrderFooterActions" style={{marginLeft:'auto'}}>
              <button type="submit" className="btnPrimary" disabled={!canSubmit}><CheckCircle2 size={17} /> {editVehicle ? 'Salvar alterações' : 'Cadastrar veículo'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function VehiclesModal({ onClose, vehicles, onCreate, onUpdate, onRemove }) {
  const [formOpen, setFormOpen] = useState(false)
  const [editVehicle, setEditVehicle] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(null)

  return (
    <div className="modalBackdrop" onClick={(e) => { if (e.target.classList.contains('modalBackdrop')) onClose() }}>
      <div className="detailModal newOrderModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>Frota</span>
            <h2>Veículos</h2>
            <p>Gerencie os veículos disponíveis para entregas</p>
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden',minHeight:0}}>
          <div className="newOrderScrollArea">
            <h3>Veículos cadastrados</h3>
            {vehicles.length === 0
              ? <p style={{color:'var(--muted)',fontWeight:700,fontSize:'.88rem',margin:'16px 0'}}>Nenhum veículo cadastrado. Clique em "Novo veículo" para adicionar.</p>
              : (
                <div className="vehiclesList">
                  {vehicles.map((v) => (
                    <div
                      key={v.id}
                      className={`vehicleCard${selectedId === v.id ? ' selected' : ''}`}
                      onClick={() => setSelectedId(selectedId === v.id ? null : v.id)}
                    >
                      <div className="vehicleCardIcon"><Truck size={22} /></div>
                      <div className="vehicleCardBody">
                        <b>{v.name}</b>
                        <span>{[v.brand, v.year ? String(v.year) : ''].filter(Boolean).join(' • ')}{v.plate ? ` • ${v.plate}` : ''}</span>
                      </div>
                      {selectedId === v.id && (
                        <div className="vehicleCardActions" onClick={(e) => e.stopPropagation()}>
                          <button className="btnSolid" onClick={() => { setEditVehicle(v); setFormOpen(true); setSelectedId(null) }}>Editar</button>
                          <button className="btnOutlineDanger" onClick={() => setConfirmRemove(v)}>Remover</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            }
          </div>
          <div className="newOrderFooter">
            <div className="newOrderFooterActions" style={{marginLeft:'auto'}}>
              <button type="button" className="btnPrimary" onClick={() => { setEditVehicle(null); setFormOpen(true) }}><Plus size={17} /> Novo veículo</button>
            </div>
          </div>
        </div>
      </div>

      {(formOpen || editVehicle) && (
        <VehicleFormModal
          editVehicle={editVehicle}
          onClose={() => { setFormOpen(false); setEditVehicle(null) }}
          onSave={(v) => {
            if (editVehicle) onUpdate(v)
            else onCreate(v)
            setFormOpen(false)
            setEditVehicle(null)
          }}
        />
      )}

      {confirmRemove && (
        <div className="cancelSepOverlay" onClick={(e) => { if (e.target.classList.contains('cancelSepOverlay')) setConfirmRemove(null) }}>
          <div className="cancelSepModal">
            <h3>Remover veículo?</h3>
            <p>O veículo <b>{confirmRemove.name}</b> será removido permanentemente da frota.</p>
            <div className="cancelSepActions">
              <button className="cancelSepConfirm" style={{background:'var(--red)'}} onClick={() => { onRemove(confirmRemove.id); setConfirmRemove(null) }}>Sim, remover</button>
              <button className="cancelSepDeny" onClick={() => setConfirmRemove(null)}>Não, voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NewDeliveryModal({ onClose, onCreate, onUpdate, editDelivery, orders, vehicles = [] }) {
  const [sellersData, setSellersData] = useState([])
  const [sellersLoading, setSellersLoading] = useState(true)
  const defaultVehicle = vehicles.length > 0 ? vehicles[0].name : ''
  const [form, setForm] = useState(() => editDelivery ? {
    sellerId: '',
    vehicle: editDelivery.vehicle || defaultVehicle,
    temperature: editDelivery.temperature ? editDelivery.temperature.replace('°C', '') : '',
    departureDate: editDelivery.departureDate ? editDelivery.departureDate.slice(0, 16) : '',
    arrivalDate: editDelivery.arrivalDate ? editDelivery.arrivalDate.slice(0, 16) : '',
    notes: editDelivery.notes || '',
  } : {
    sellerId: '',
    vehicle: defaultVehicle,
    temperature: '',
    departureDate: '',
    arrivalDate: '',
    notes: '',
  })

  useEffect(() => {
    fetch(`${API_URL}/api/sellers`)
      .then((r) => r.json())
      .then((data) => {
        if (data.sellers) {
          setSellersData(data.sellers)
          if (editDelivery?.driver) {
            const match = data.sellers.find((s) => s.name === editDelivery.driver)
            if (match) setForm((f) => ({ ...f, sellerId: String(match.id) }))
          }
        }
      })
      .catch(() => {})
      .finally(() => setSellersLoading(false))
  }, [])

  const [selectedCities, setSelectedCities] = useState(() => {
    if (!editDelivery?.route) return []
    return editDelivery.route.split(' → ').map((c) => c.trim()).filter(Boolean)
  })
  const [citySearch, setCitySearch] = useState('')
  const [showCitySuggestions, setShowCitySuggestions] = useState(false)
  const cityInputRef = useRef(null)

  const citySuggestions = citySearch.trim().length >= 2
    ? SC_CITIES.filter((c) =>
        c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(
          citySearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        ) && !selectedCities.includes(c)
      ).slice(0, 8)
    : []

  const addCity = (city) => {
    setSelectedCities((prev) => [...prev, city])
    setCitySearch('')
    setShowCitySuggestions(false)
    cityInputRef.current?.focus()
  }

  const removeCity = (city) => setSelectedCities((prev) => prev.filter((c) => c !== city))

  const [selectedOrderIds, setSelectedOrderIds] = useState(editDelivery?.orderIds || [])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const toggleOrder = (id) => setSelectedOrderIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  const eligibleOrders = orders.filter((o) => !o.isDeleted && (o.status === 'Separação' || o.status === 'Pronto'))
  const canSubmit = selectedCities.length > 0 && form.sellerId !== ''

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit || saving) return
    const route = selectedCities.join(' → ')
    const seller = sellersData.find((s) => s.id === Number(form.sellerId))
    setSaving(true)
    setSaveError('')
    try {
      if (editDelivery) {
        const res = await fetch(`${API_URL}/api/deliveries`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deliveryId: editDelivery.id,
            fullUpdate: true,
            route,
            sellerId: Number(form.sellerId),
            vehicle: form.vehicle,
            stops: selectedCities.length,
            temperature: form.temperature ? parseFloat(form.temperature) : null,
            departureDate: form.departureDate || null,
            arrivalDate: form.arrivalDate || null,
            notes: form.notes,
            orderIds: selectedOrderIds,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setSaveError(data.error || 'Erro ao salvar.'); return }
        onUpdate({
          ...editDelivery,
          route,
          driver: seller ? seller.name : editDelivery.driver,
          driverPhone: seller ? seller.phone : editDelivery.driverPhone,
          vehicle: form.vehicle,
          stops: selectedCities.length,
          temperature: form.temperature ? form.temperature + '°C' : editDelivery.temperature,
          departureDate: form.departureDate || null,
          arrivalDate: form.arrivalDate || null,
          notes: form.notes,
          orderIds: selectedOrderIds,
        })
      } else {
        const res = await fetch(`${API_URL}/api/deliveries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sellerId: Number(form.sellerId),
            route,
            vehicle: form.vehicle,
            stops: selectedCities.length,
            temperature: form.temperature ? parseFloat(form.temperature) : -18.0,
            departureDate: form.departureDate || null,
            arrivalDate: form.arrivalDate || null,
            notes: form.notes,
            orderIds: selectedOrderIds,
          }),
        })
        const data = await res.json()
        if (!res.ok) { setSaveError(data.error || 'Erro ao criar entrega.'); return }
        onCreate({
          id: data.code,
          route,
          driver: seller ? seller.name : '',
          driverPhone: seller ? seller.phone : '',
          vehicle: form.vehicle,
          stops: selectedCities.length,
          temperature: form.temperature ? form.temperature + '°C' : '-18.0°C',
          status: 'Planejada',
          progress: 0,
          departureDate: form.departureDate || null,
          arrivalDate: form.arrivalDate || null,
          notes: form.notes,
          orderIds: selectedOrderIds,
        })
      }
      onClose()
    } catch {
      setSaveError('Não foi possível conectar ao servidor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modalBackdrop">
      <div className="detailModal newOrderModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>Rota de entrega</span>
            <h2>{editDelivery ? 'Editar entrega' : 'Nova entrega'}</h2>
            <p>{editDelivery ? 'Altere as informações da rota e salve as modificações' : 'Preencha as informações da rota e do entregador'}</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <div className="newOrderScrollArea">
            <h3>Rota e entregador</h3>
            <div className="settingsForm">
              <label>Cidades da rota *
                <div className="cityPickerWrapper">
                  <div className="cityTagList">
                    {selectedCities.map((city, idx) => (
                      <span key={city} className="cityTag">
                        {idx > 0 && <span className="cityTagArrow">→</span>}
                        {city}
                        <button type="button" className="cityTagRemove" onClick={() => removeCity(city)}><X size={12} /></button>
                      </span>
                    ))}
                    <div className="citySearchInputWrapper">
                      <input
                        ref={cityInputRef}
                        className="citySearchInput"
                        placeholder={selectedCities.length === 0 ? 'Digite o nome de uma cidade de SC...' : 'Adicionar cidade...'}
                        value={citySearch}
                        onChange={(e) => { setCitySearch(e.target.value); setShowCitySuggestions(true) }}
                        onFocus={() => setShowCitySuggestions(true)}
                        onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (citySuggestions.length > 0) addCity(citySuggestions[0]) } }}
                      />
                      {showCitySuggestions && citySuggestions.length > 0 && (
                        <ul className="citySuggestions">
                          {citySuggestions.map((city) => (
                            <li key={city} onMouseDown={() => addCity(city)}>{city}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </label>
              <label>Entregador *
                <CustomSelect
                  value={form.sellerId}
                  onChange={(v) => set('sellerId', v)}
                  placeholder={sellersLoading ? 'Carregando entregadores...' : 'Selecione o entregador'}
                  options={sellersData.map((s) => ({ value: String(s.id), label: `${s.name} • ${s.phone}` }))}
                />
              </label>
              <label>Veículo / Câmara fria
                <CustomSelect
                  value={form.vehicle}
                  onChange={(v) => set('vehicle', v)}
                  placeholder={vehicles.length === 0 ? 'Nenhum veículo cadastrado' : 'Selecione o veículo'}
                  options={vehicles.map((v) => ({ value: v.name, label: `${v.name}${v.plate ? ` • ${v.plate}` : ''}` }))}
                />
              </label>
            </div>

            <h3 className="newOrderSectionTitle">Pedidos para esta entrega</h3>
            {eligibleOrders.length === 0
              ? <p style={{color:'var(--muted)',fontWeight:700,fontSize:'.88rem',margin:'0 0 12px'}}>Nenhum pedido em separação ou pronto no momento.</p>
              : (
                <div className="deliveryOrderChecklist">
                  {eligibleOrders.map((o) => (
                    <label key={o.id} className={`deliveryOrderCheckItem${selectedOrderIds.includes(o.id) ? ' selected' : ''}`}>
                      <input type="checkbox" checked={selectedOrderIds.includes(o.id)} onChange={() => toggleOrder(o.id)} />
                      <div className="deliveryOrderCheckBody">
                        <b>{o.id}</b>
                        <span>{o.customer}</span>
                        <small>{o.city} • {money(o.value)}</small>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'4px'}}>
                        {selectedOrderIds.includes(o.id) && <CheckCircle2 size={18} color="var(--orange)" />}
                        <Status status={o.status} />
                      </div>
                    </label>
                  ))}
                </div>
              )
            }

            <h3 className="newOrderSectionTitle">Detalhes da rota</h3>
            <div className="settingsForm">
              <label>Temperatura da câmara (°C)
                <input placeholder="Ex: -18.0" value={form.temperature} onChange={(e) => set('temperature', e.target.value)} />
              </label>
            </div>

            <h3 className="newOrderSectionTitle">Datas <span style={{fontWeight:400,fontSize:'.8rem',color:'var(--muted)'}}>— opcionais</span></h3>
            <div className="settingsForm">
              <label>Data de saída
                <DateTimePicker value={form.departureDate} onChange={(v) => set('departureDate', v)} placeholder="Selecionar data e hora" />
              </label>
              <label>Data de chegada prevista
                <DateTimePicker value={form.arrivalDate} onChange={(v) => set('arrivalDate', v)} placeholder="Selecionar data e hora" />
              </label>
            </div>

            <div className="noteBox" style={{marginTop:'16px'}}>
              <b>Observações</b>
              <textarea rows={3} placeholder="Instruções especiais, cuidados com a carga..." value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>

          <div className="newOrderFooter">
            {selectedOrderIds.length > 0 && (
              <div className="newOrderTotalInline">
                <span>Pedidos selecionados</span>
                <strong>{selectedOrderIds.length} pedido{selectedOrderIds.length > 1 ? 's' : ''}</strong>
              </div>
            )}
            <div className="newOrderFooterActions">
              {saveError && <small className="errorText">{saveError}</small>}
              <button type="submit" className="btnPrimary" disabled={!canSubmit || saving}><CheckCircle2 size={17} /> {saving ? 'Salvando...' : editDelivery ? 'Salvar alterações' : 'Criar entrega'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeliveryDetailModal({ delivery, onClose, orders, onCancel, onRemove, onReactivate, onEdit, onSelectOrder }) {
  const [liveTemp, setLiveTemp] = useState(() => parseFloat(delivery.temperature) || -18.0)
  const [liveProgress, setLiveProgress] = useState(delivery.progress)
  const [elapsed, setElapsed] = useState(0)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTemp((t) => parseFloat((t + (Math.random() * 0.06 - 0.03)).toFixed(1)))
      setElapsed((e) => e + 1)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const statusSteps = ['Planejada', 'Carregando', 'Em rota', 'Concluída']
  const currentStep = statusSteps.indexOf(delivery.status)
  const isCancelled = delivery.status === 'Cancelada'

  const fmtDate = (val) => {
    if (!val) return '—'
    try { return new Date(val).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return val }
  }

  const tempColor = liveTemp > -15 ? 'var(--red)' : liveTemp > -17 ? 'var(--orange)' : 'var(--green)'

  return (
    <div className="modalBackdrop" onClick={(e) => { if (e.target.classList.contains('modalBackdrop')) onClose() }}>
      <div className="detailModal deliveryDetailModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>{delivery.id}</span>
            <h2>{delivery.driver}</h2>
            <p>{delivery.route}</p>
          </div>
          <Status status={delivery.status} />
        </div>

        <div className="newOrderScrollArea" style={{padding:'0 28px 24px'}}>

          {/* Progresso da rota */}
          <div className="deliveryDetailSection">
            <h4>Progresso da rota</h4>

            {/* Steps */}
            {!isCancelled && (
              <div className="deliverySteps">
                {statusSteps.map((step, idx) => (
                  <div key={step} className={`deliveryStep ${idx < currentStep ? 'done' : ''} ${idx === currentStep ? 'active' : ''}`}>
                    <div className="deliveryStepDot">{idx < currentStep ? <CheckCircle2 size={14}/> : <span>{idx + 1}</span>}</div>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            )}
            {isCancelled && <p style={{color:'var(--red)',fontWeight:700,marginTop:'10px'}}>Esta entrega foi cancelada.</p>}
          </div>

          {/* Localização em tempo real - hidden, reserved for future use */}
          {false && (
          <div className="deliveryDetailSection">
            <h4>Localização em tempo real</h4>
            <div className="deliveryTempCard">
              <div className="deliveryTempMeta">
                <span style={{fontWeight:700}}>{delivery.route}</span>
                <small style={{color:'var(--green)'}}>GPS ativo</small>
              </div>
              <span className="deliveryTempLive"><span className="liveDot"></span>Ao vivo</span>
            </div>
          </div>
          )}

          {/* Informações */}
          <div className="deliveryDetailSection">
            <h4>Informações da entrega</h4>
            <div className="deliveryInfoGrid">
              <div className="deliveryInfoItem"><small>Entregador</small><b>{delivery.driver}</b></div>
              <div className="deliveryInfoItem"><small>Veículo</small><b>{delivery.vehicle}</b></div>
              <div className="deliveryInfoItem"><small>Paradas</small><b>{delivery.stops}</b></div>
              <div className="deliveryInfoItem"><small>Status</small><b>{delivery.status}</b></div>
              <div className="deliveryInfoItem"><small>Data de saída</small><b>{fmtDate(delivery.departureDate)}</b></div>
              <div className="deliveryInfoItem"><small>Chegada prevista</small><b>{fmtDate(delivery.arrivalDate)}</b></div>
            </div>
          </div>

          {/* Pedidos em rota */}
          {delivery.orderIds?.length > 0 && (
            <div className="deliveryDetailSection">
              <h4><ShoppingCart size={15} /> Pedidos nesta entrega</h4>
              <div className="deliveryOrdersList">
                {delivery.orderIds.map((oid) => {
                  const o = orders.find((x) => x.id === oid)
                  if (!o) return <div key={oid} className="deliveryOrdersItem"><b>{oid}</b></div>
                  return (
                    <div key={oid} className="deliveryOrdersItem deliveryOrdersItemClickable" onClick={() => onSelectOrder(o)}>
                      <div className="deliveryOrdersItemBody">
                        <b>{o.id}</b>
                        <span>{o.customer}</span>
                        <small>{o.city} • {money(o.value)}</small>
                      </div>
                      <Status status={o.status} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Observações */}
          {delivery.notes && (
            <div className="deliveryDetailSection">
              <h4><ClipboardList size={15} /> Observações</h4>
              <p style={{color:'var(--muted)',fontWeight:600,lineHeight:1.5}}>{delivery.notes}</p>
            </div>
          )}

          {/* Acompanhamento ao vivo - hidden, reserved for future use */}
          {false && delivery.status === 'Em rota' && (
          <div className="deliveryDetailSection">
            <h4>Acompanhamento ao vivo</h4>
            <div className="deliveryLiveLog">
              <div className="deliveryLogItem"><span className="liveDot"></span><span>Temperatura: <b style={{color:tempColor}}>{liveTemp.toFixed(1)}°C</b></span><small>agora</small></div>
              {elapsed > 0 && <div className="deliveryLogItem"><CheckCircle2 size={13} color="var(--green)"/><span>Sinal GPS ativo</span><small>{elapsed * 3}s atrás</small></div>}
              <div className="deliveryLogItem"><CheckCircle2 size={13} color="var(--green)"/><span>Câmara lacrada e operacional</span><small>início</small></div>
              <div className="deliveryLogItem"><CheckCircle2 size={13} color="var(--green)"/><span>Checklist de saída concluído</span><small>início</small></div>
            </div>
          </div>
          )}

        </div>

        {(delivery.status === 'Planejada' || delivery.status === 'Carregando') && (
          <div className="newOrderFooter" style={{borderTop:'1px solid var(--line)',padding:'16px 28px',gap:'10px',justifyContent:'flex-end'}}>
            <div className="newOrderFooterActions" style={{marginLeft:'auto'}}>
              <button type="button" className="orderModalBtnDanger" onClick={() => setConfirmCancel(true)}>Cancelar entrega</button>
              <button type="button" className="btnPrimary" onClick={() => onEdit(delivery)}><ClipboardEdit size={16} /> Editar entrega</button>
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="newOrderFooter" style={{borderTop:'1px solid var(--line)',padding:'16px 28px',gap:'10px',justifyContent:'flex-end'}}>
            <div className="newOrderFooterActions" style={{marginLeft:'auto'}}>
              <button type="button" className="orderModalBtnDanger" onClick={() => setConfirmRemove(true)}>Remover</button>
              <button type="button" className="btnPrimary" onClick={() => onReactivate(delivery.id)}><CheckCircle2 size={16} /> Reativar</button>
            </div>
          </div>
        )}

      </div>

      {confirmCancel && (
        <div className="cancelSepOverlay" onClick={(e) => { if (e.target.classList.contains('cancelSepOverlay')) setConfirmCancel(false) }}>
          <div className="cancelSepModal">
            <h3>Cancelar entrega?</h3>
            <p>A entrega <b>{delivery.id}</b> de <b>{delivery.driver}</b> será cancelada e o progresso zerado.</p>
            <div className="cancelSepActions">
              <button className="cancelSepConfirm" style={{background:'var(--red)'}} onClick={() => { setConfirmCancel(false); onCancel(delivery.id) }}>Sim, cancelar entrega</button>
              <button className="cancelSepDeny" onClick={() => setConfirmCancel(false)}>Não, voltar</button>
            </div>
          </div>
        </div>
      )}

      {confirmRemove && (
        <div className="cancelSepOverlay" onClick={(e) => { if (e.target.classList.contains('cancelSepOverlay')) setConfirmRemove(false) }}>
          <div className="cancelSepModal">
            <h3>Remover entrega?</h3>
            <p>A entrega <b>{delivery.id}</b> de <b>{delivery.driver}</b> será removida permanentemente do sistema.</p>
            <div className="cancelSepActions">
              <button className="cancelSepConfirm" style={{background:'var(--red)'}} onClick={() => { setConfirmRemove(false); onRemove(delivery.id) }}>Sim, remover entrega</button>
              <button className="cancelSepDeny" onClick={() => setConfirmRemove(false)}>Não, voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Clients({ clientsData = [], clientsLoading = false, onNewClient, onSelectClient, search = '' }) {
  const [viewMode, setViewMode] = useState('grid')
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const viewMenuRef = useRef(null)

  const filtered = !search
    ? clientsData
    : clientsData.filter((c) =>
        (c.establishmentName || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.city || '').toLowerCase().includes(search.toLowerCase())
      )

  useEffect(() => {
    if (!viewMenuOpen) return
    const handleClick = (e) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target)) setViewMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [viewMenuOpen])

  const getPriorityStatus = (priority) => {
    const p = (priority || '').toLowerCase()
    if (p === 'baixa') return 'Reativar'
    return 'Ativo'
  }

  const viewOptions = [
    { key: 'grid', icon: LayoutGrid, label: 'Cards' },
    { key: 'list', icon: List, label: 'Lista' },
  ]

  return (
    <section className="pageStack">
      <div className="sectionHeader stockSectionHeader">
        <div><p>Carteira comercial</p></div>
        <div className="viewFilterWrap" ref={viewMenuRef}>
          <button className="viewFilterBtn" onClick={() => setViewMenuOpen(!viewMenuOpen)}>
            <LayoutGrid size={16} /> Visualização <ChevronDown size={14} style={{ transform: viewMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </button>
          {viewMenuOpen && (
            <div className="viewFilterDropdown">
              {viewOptions.map(({ key, icon: Icon, label }) => (
                <button key={key} className={viewMode === key ? 'active' : ''} onClick={() => { setViewMode(key); setViewMenuOpen(false) }}>
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btnSolid" onClick={onNewClient}><Plus size={18} /> Novo cliente</button>
      </div>
      {clientsLoading && <p className="loadingText">Carregando clientes...</p>}
      {!clientsLoading && filtered.length === 0 && <p className="emptyText">Nenhum cliente cadastrado.</p>}
      {viewMode === 'grid' ? (
        <div className="clientGrid">
          {filtered.map((client) => (
            <article className="clientCard" key={client.id}>
              <div className="avatar">{(client.establishmentName || client.clientName || 'C')[0].toUpperCase()}</div>
              <div><h3>{client.establishmentName}</h3><p>{client.segment || '—'}</p></div>
              <Status status={getPriorityStatus(client.priority)} />
              <div className="clientStats">
                <span>Responsável <b>{client.clientName || '—'}</b></span>
                <span>Cidade <b>{client.city || '—'}</b></span>
                {client.lastPurchase && <span>Última compra <b>{client.lastPurchase}</b></span>}
                {client.avgTicket != null && client.avgTicket > 0 && <span>Ticket médio <b>{money(client.avgTicket)}</b></span>}
              </div>
              <div className="orderActions">
                <button onClick={() => onSelectClient && onSelectClient(client)}>Ver detalhes</button>
                {client.contactNumber && (
                  <a
                    href={`https://wa.me/${client.contactNumber.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                    style={{ all: 'unset', cursor: 'pointer' }}
                  >
                    <button>Fazer contato</button>
                  </a>
                )}
                {!client.contactNumber && <button disabled>Fazer contato</button>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="clientListView">
          {filtered.map((client) => (
            <article className="clientListItem" key={client.id}>
              <div className="clientListAvatar">{(client.establishmentName || client.clientName || 'C')[0].toUpperCase()}</div>
              <div className="clientListInfo">
                <h3>{client.establishmentName}</h3>
                <p>{[client.segment, client.city].filter(Boolean).join(' • ') || '—'}</p>
              </div>
              <div className="clientListMeta">
                {client.avgTicket != null && client.avgTicket > 0 && <span>Ticket médio <b>{money(client.avgTicket)}</b></span>}
              </div>
              <Status status={getPriorityStatus(client.priority)} />
              <div className="clientListActions">
                <button onClick={() => onSelectClient && onSelectClient(client)}>Ver detalhes</button>
                {client.contactNumber ? (
                  <a
                    href={`https://wa.me/${client.contactNumber.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ all: 'unset', cursor: 'pointer' }}
                  >
                    <button>Contato</button>
                  </a>
                ) : (
                  <button disabled>Contato</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function ClientDetailModal({ client, onClose, onEdit, onRemove }) {
  return (
    <div className="modalBackdrop">
      <div className="detailModal newOrderModal supplierDetailModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>Cliente</span>
            <h2>{client.establishmentName}</h2>
            <p>Informações completas do cliente</p>
          </div>
        </div>
        <div className="newOrderScrollArea">
          <h3>Dados do cliente</h3>
          <div className="supplierDetailGrid">
            <div className="supplierDetailItem"><span>Responsável</span><b>{client.clientName || '—'}</b></div>
            <div className="supplierDetailItem"><span>Segmento</span><b>{client.segment || '—'}</b></div>
            <div className="supplierDetailItem"><span>WhatsApp / Contato</span><b>{client.contactNumber || '—'}</b></div>
            <div className="supplierDetailItem"><span>Cidade</span><b>{client.city || '—'}</b></div>
            {client.address && <div className="supplierDetailItem supplierDetailFull"><span><MapPin size={12} /> Endereço</span><b>{client.address}</b></div>}
          </div>

          <div className="supplierDetailDivider" />

          <h3>Dados fiscais</h3>
          <div className="supplierDetailGrid">
            <div className="supplierDetailItem">
              <span>{client.documentType === 'cpf' ? 'CPF' : 'CNPJ'}</span>
              <b>{client.document || client.cnpj || '—'}</b>
            </div>
            <div className="supplierDetailItem"><span>Preferência de nota fiscal</span><b>{client.invoicePreference || '—'}</b></div>
          </div>

          <div className="supplierDetailDivider" />

          <h3>Classificação comercial</h3>
          <div className="supplierDetailGrid">
            <div className="supplierDetailItem"><span>Prioridade</span><b>{client.priority || '—'}</b></div>
            <div className="supplierDetailItem"><span>Melhor dia para visita</span><b>{client.bestDay || '—'}</b></div>
            {client.priorityReason && <div className="supplierDetailItem supplierDetailFull"><span>Motivo da prioridade</span><b>{client.priorityReason}</b></div>}
            {client.tag && <div className="supplierDetailItem"><span>Tag</span><b>{client.tag}</b></div>}
            {client.avgTicket != null && client.avgTicket > 0 && <div className="supplierDetailItem"><span>Ticket médio</span><b>{money(client.avgTicket)}</b></div>}
            {client.lastPurchase && <div className="supplierDetailItem"><span>Última compra</span><b>{client.lastPurchase}</b></div>}
          </div>

          {client.email && (
            <>
              <div className="supplierDetailDivider" />
              <h3>Acesso ao app</h3>
              <div className="supplierDetailGrid">
                <div className="supplierDetailItem"><span>E-mail de acesso</span><b>{client.email}</b></div>
              </div>
            </>
          )}
        </div>
        <div className="newOrderFooter">
          <div className="newOrderFooterActions" style={{ marginLeft: 'auto' }}>
            <button type="button" className="orderModalBtn orderModalBtnDanger" onClick={() => onRemove(client)}>Remover</button>
            <button type="button" className="btnPrimary" onClick={() => onEdit(client)}>
              <ClipboardEdit size={16} /> Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NewClientModal({ onClose, onCreated, editClient, onUpdated }) {
  const [form, setForm] = useState(() => editClient ? {
    establishmentName: editClient.establishmentName || '',
    clientName: editClient.clientName || '',
    email: editClient.email || '',
    documentType: editClient.documentType || 'cnpj',
    cnpj: editClient.document || editClient.cnpj || '',
    contactNumber: editClient.contactNumber || '',
    address: editClient.address || '',
    city: editClient.city || '',
    segment: editClient.segment || '',
    priority: editClient.priority || 'Media',
    priorityReason: editClient.priorityReason || '',
    tag: editClient.tag || '',
    invoicePreference: editClient.invoicePreference || '',
    bestDay: editClient.bestDay || '',
  } : {
    establishmentName: '',
    clientName: '',
    email: '',
    documentType: 'cnpj',
    cnpj: '',
    contactNumber: '',
    address: '',
    city: '',
    segment: '',
    priority: 'Media',
    priorityReason: '',
    tag: '',
    invoicePreference: '',
    bestDay: '',
  })
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const isDirty = editClient ? (
    form.establishmentName !== (editClient.establishmentName || '') ||
    form.clientName !== (editClient.clientName || '') ||
    form.email !== (editClient.email || '') ||
    form.documentType !== (editClient.documentType || 'cnpj') ||
    form.cnpj !== (editClient.document || editClient.cnpj || '') ||
    form.contactNumber !== (editClient.contactNumber || '') ||
    form.address !== (editClient.address || '') ||
    form.city !== (editClient.city || '') ||
    form.segment !== (editClient.segment || '') ||
    form.priority !== (editClient.priority || 'Media') ||
    form.priorityReason !== (editClient.priorityReason || '') ||
    form.tag !== (editClient.tag || '') ||
    form.invoicePreference !== (editClient.invoicePreference || '') ||
    form.bestDay !== (editClient.bestDay || '')
  ) : true

  const canSubmit = form.establishmentName.trim() !== '' && form.clientName.trim() !== '' && isDirty

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitError('')
    setSubmitting(true)
    try {
      const payload = {
        establishmentName: form.establishmentName.trim(),
        clientName: form.clientName.trim(),
        email: form.email.trim() || null,
        documentType: form.documentType,
        cnpj: form.cnpj.trim() || null,
        contactNumber: form.contactNumber.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        segment: form.segment.trim() || null,
        priority: form.priority || 'Media',
        priorityReason: form.priorityReason.trim() || null,
        tag: form.tag.trim() || null,
        invoicePreference: form.invoicePreference.trim() || null,
        bestDay: form.bestDay.trim() || null,
      }
      if (editClient) {
        const res = await fetch(`${API_URL}/api/clients`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editClient.id, userId: editClient.userId, ...payload }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar cliente')
        onUpdated({ ...editClient, ...payload })
        onClose()
      } else {
        const res = await fetch(`${API_URL}/api/clients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar cliente')
        onCreated(data.client)
        onClose()
      }
    } catch (err) {
      setSubmitError(err.message || 'Erro ao salvar cliente. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const sectionTitle = { gridColumn: '1 / -1', fontWeight: 600, fontSize: '.82rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginTop: 8, marginBottom: 0 }

  return (
    <div className="modalBackdrop">
      <div className="detailModal newProductModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>{editClient ? 'Edição' : 'Clientes'}</span>
            <h2>{editClient ? 'Editar cliente' : 'Novo cliente'}</h2>
            <p>{editClient ? 'Altere os dados do cliente e salve as modificações' : 'Preencha os dados para cadastrar o cliente na carteira comercial'}</p>
          </div>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <div className="newProductScrollArea">
            <div className="newProductForm">

              <p style={sectionTitle}>Identificação</p>
              <label className="full">Nome do estabelecimento *
                <input placeholder="Ex: Padaria Bela Vista" value={form.establishmentName} onChange={(e) => set('establishmentName', e.target.value)} required />
              </label>
              <label>Nome do responsável *
                <input placeholder="Ex: João da Silva" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} required />
              </label>
              <label>Segmento
                <input placeholder="Ex: Padaria, Restaurante" value={form.segment} onChange={(e) => set('segment', e.target.value)} />
              </label>

              <p style={sectionTitle}>Contato</p>
              <label>WhatsApp / Contato
                <input placeholder="(49) 99910-1111" value={form.contactNumber} onChange={(e) => set('contactNumber', e.target.value)} />
              </label>
              <label>E-mail de contato
                <input type="email" placeholder="cliente@email.com" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </label>
              <label>Cidade
                <input placeholder="Ex: Lages - SC" value={form.city} onChange={(e) => set('city', e.target.value)} />
              </label>
              <label className="full">Endereço
                <input placeholder="Ex: Rua das Flores, 123 – Lages, SC" value={form.address} onChange={(e) => set('address', e.target.value)} />
              </label>

              <p style={sectionTitle}>Dados fiscais</p>
              <label className="full">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span>Documento fiscal</span>
                  <div className="deliverySegmented">
                    <button type="button" className={`deliverySegBtn${form.documentType === 'cnpj' ? ' active' : ''}`} onClick={() => set('documentType', 'cnpj')}>CNPJ</button>
                    <button type="button" className={`deliverySegBtn${form.documentType === 'cpf' ? ' active' : ''}`} onClick={() => set('documentType', 'cpf')}>CPF</button>
                  </div>
                </div>
                <input
                  placeholder={form.documentType === 'cnpj' ? '00.000.000/0001-00' : '000.000.000-00'}
                  value={form.cnpj}
                  onChange={(e) => set('cnpj', e.target.value)}
                />
              </label>
              <label>Preferência de nota fiscal
                <input placeholder="Ex: CNPJ, CPF, Sem nota" value={form.invoicePreference} onChange={(e) => set('invoicePreference', e.target.value)} />
              </label>

              <p style={sectionTitle}>Classificação comercial</p>
              <label>Prioridade
                <CustomSelect
                  value={form.priority}
                  onChange={(v) => set('priority', v)}
                  options={[
                    { value: 'Alta', label: 'Alta' },
                    { value: 'Media', label: 'Média' },
                    { value: 'Baixa', label: 'Baixa' },
                  ]}
                />
              </label>
              <label>Melhor dia para visita
                <input placeholder="Ex: Terça-feira" value={form.bestDay} onChange={(e) => set('bestDay', e.target.value)} />
              </label>
              <label>Motivo da prioridade
                <input placeholder="Ex: Alto volume de compras" value={form.priorityReason} onChange={(e) => set('priorityReason', e.target.value)} />
              </label>
              <label>Tag
                <input placeholder="Ex: VIP, Novo, Atacado" value={form.tag} onChange={(e) => set('tag', e.target.value)} />
              </label>

            </div>
            {submitError && <small className="errorText" style={{ marginTop: 12, display: 'block' }}>{submitError}</small>}
          </div>
          <div className="newProductFooter">
            <button type="submit" className="btnPrimary" disabled={!canSubmit || submitting}>
              <CheckCircle2 size={17} /> {submitting ? (editClient ? 'Salvando...' : 'Cadastrando...') : (editClient ? 'Salvar alterações' : 'Cadastrar cliente')}
            </button>
          </div>
        </form>
      </div>
    </div>
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

function AutomationActionDialog({ automation, isActive, onClose, onActivate, onAdjust }) {
  return (
    <div className="nfOverlay" onClick={(e) => e.target.classList.contains('nfOverlay') && onClose()}>
      <div className="autoActionDialog">
        <button className="nfClose" onClick={onClose}><X size={16} /></button>
        <div className="autoActionIcon"><Settings2 size={28} /></div>
        <h3>{automation}</h3>
        <p>O que deseja fazer com esta automação?</p>
        <div className="autoActionButtons">
          <button className="autoActionBtnAdjust" onClick={onAdjust}><Settings2 size={16} /> Ajustar</button>
          <button className="autoActionBtnActivate" onClick={onActivate}>
            {isActive ? <><X size={16} /> Desativar</> : <><Sparkles size={16} /> Ativar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function AutomationAdjustModal({ onClose, onActivate, isActive, notify }) {
  const [sellers, setSellers] = useState([])
  const [clients, setClients] = useState([])
  const [saving, setSaving] = useState(false)
  const [activating, setActivating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState({
    minOrders: 1,
    maxOrders: 10,
    maxCities: 5,
    includeRouteCities: false,
    timeIntervalMinutes: 30,
    timeStart: '07:00',
    timeEnd: '18:00',
  })
  const [bindings, setBindings] = useState([])
  const [savedConfig, setSavedConfig] = useState(null)
  const [savedBindings, setSavedBindings] = useState(null)
  const [bindingForm, setBindingForm] = useState({ sellerId: '', type: 'city', value: '' })
  const [citySearch, setCitySearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [showCitySugg, setShowCitySugg] = useState(false)
  const [showClientSugg, setShowClientSugg] = useState(false)
  const cityRef = useRef(null)
  const clientRef = useRef(null)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [sellersRes, clientsRes, cfgRes] = await Promise.all([
          fetch(`${API_URL}/api/sellers`).then((r) => r.json()).catch(() => ({ sellers: [] })),
          fetch(`${API_URL}/api/clients`).then((r) => r.json()).catch(() => ({ clients: [] })),
          fetch(`${API_URL}/api/automation-config?key=receive_orders`).then((r) => r.json()).catch(() => null),
        ])
        if (sellersRes.sellers) setSellers(sellersRes.sellers.filter((s) => s.status === 'Ativo'))
        if (clientsRes.clients) setClients(clientsRes.clients)
        if (cfgRes?.config) {
          const c = cfgRes.config
          const loadedConfig = {
            minOrders: c.minOrders ?? 1,
            maxOrders: c.maxOrders ?? 10,
            maxCities: c.maxCities ?? 5,
            includeRouteCities: !!c.includeRouteCities,
            timeIntervalMinutes: c.timeIntervalMinutes ?? 30,
            timeStart: c.timeStart ?? '07:00',
            timeEnd: c.timeEnd ?? '18:00',
          }
          const loadedBindings = cfgRes.bindings ?? []
          setConfig(loadedConfig)
          setBindings(loadedBindings)
          setSavedConfig(loadedConfig)
          setSavedBindings(loadedBindings)
        } else {
          // No config in DB yet — treat current defaults as the saved baseline
          setSavedConfig({ minOrders: 1, maxOrders: 10, maxCities: 5, includeRouteCities: false, timeIntervalMinutes: 30, timeStart: '07:00', timeEnd: '18:00' })
          setSavedBindings([])
        }
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    fetchAll()
  }, [])

  const setC = (k, v) => setConfig((p) => ({ ...p, [k]: v }))

  const isDirty = savedConfig !== null && (
    JSON.stringify(config) !== JSON.stringify(savedConfig) ||
    JSON.stringify(bindings.map(({ sellerId, bindingType, bindingValue }) => ({ sellerId, bindingType, bindingValue }))) !==
    JSON.stringify((savedBindings ?? []).map(({ sellerId, bindingType, bindingValue }) => ({ sellerId, bindingType, bindingValue })))
  )

  const citySugg = citySearch.trim().length >= 2
    ? SC_CITIES.filter((c) =>
        c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(
          citySearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        )
      ).slice(0, 8)
    : []

  const clientSugg = clientSearch.trim().length >= 2
    ? clients.filter((c) =>
        (c.establishmentName || '').toLowerCase().includes(clientSearch.toLowerCase())
      ).slice(0, 8)
    : []

  const addBinding = () => {
    const val = bindingForm.type === 'city' ? citySearch.trim() : clientSearch.trim()
    if (!bindingForm.sellerId || !val) return
    const seller = sellers.find((s) => String(s.id) === String(bindingForm.sellerId))
    if (!seller) return
    if (bindings.find((b) => b.sellerId === Number(bindingForm.sellerId) && b.bindingType === bindingForm.type && b.bindingValue === val)) return
    setBindings((prev) => [...prev, { sellerId: Number(bindingForm.sellerId), sellerName: seller.name, bindingType: bindingForm.type, bindingValue: val }])
    setCitySearch('')
    setClientSearch('')
  }

  const removeBinding = (idx) => setBindings((prev) => prev.filter((_, i) => i !== idx))

  const handleSave = async (silent = false) => {
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/automation-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'receive_orders', config, bindings }),
      })
      if (res.ok) {
        if (!silent) notify('Configurações salvas com sucesso.')
        setSavedConfig(config)
        setSavedBindings(bindings)
      } else if (!silent) notify('Erro ao salvar configurações.')
      return res.ok
    } catch {
      if (!silent) notify('Erro ao salvar configurações.')
      return false
    } finally { setSaving(false) }
  }

  const handleActivate = async () => {
    setActivating(true)
    try {
      const saved = await handleSave(true)
      if (saved) await onActivate()
      else notify('Erro ao salvar configurações.')
    } finally { setActivating(false) }
  }

  return (
    <div className="nfOverlay" onClick={(e) => e.target.classList.contains('nfOverlay') && onClose()}>
      <div className="autoAdjustModal">
        <div className="autoAdjustHeader">
          <div className="autoAdjustHeaderInfo">
            <div>
              <span>Automação</span>
              <h2>Receber pedidos do app</h2>
              <p>Configure como esta automação deve funcionar</p>
            </div>
          </div>
          <button className="nfClose" style={{ position: 'static' }} onClick={onClose}><X size={16} /></button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '32px 28px', color: 'var(--muted)', fontWeight: 700 }}>
            <Loader2 size={18} className="verNotaDetailsSpinner" /> Carregando configurações...
          </div>
        ) : (
          <div className="autoAdjustBody">

            {/* Quantidade de pedidos */}
            <div className="autoAdjustSection">
              <div className="autoAdjustSectionTitle"><Package size={15} /> Quantidade de pedidos por entrega</div>
              <div className="autoAdjustRow">
                <label>
                  <span>Mínimo</span>
                  <input type="number" min={1} max={config.maxOrders} value={config.minOrders}
                    onChange={(e) => setC('minOrders', Math.max(1, Number(e.target.value)))} />
                </label>
                <label>
                  <span>Máximo</span>
                  <input type="number" min={config.minOrders} max={100} value={config.maxOrders}
                    onChange={(e) => setC('maxOrders', Math.max(config.minOrders, Number(e.target.value)))} />
                </label>
              </div>
            </div>

            {/* Cidades */}
            <div className="autoAdjustSection">
              <div className="autoAdjustSectionTitle"><MapPin size={15} /> Cidades por entrega</div>
              <div className="autoAdjustRow">
                <label style={{ flex: 1 }}>
                  <span>Máximo de cidades</span>
                  <input type="number" min={1} max={50} value={config.maxCities}
                    onChange={(e) => setC('maxCities', Math.max(1, Number(e.target.value)))} />
                </label>
              </div>
              <label className="autoAdjustCheckRow">
                <input type="checkbox" checked={config.includeRouteCities}
                  onChange={(e) => setC('includeRouteCities', e.target.checked)} />
                <div>
                  <span>Incluir cidades no caminho</span>
                  <small>Ao criar a entrega, selecionar automaticamente todas as cidades que ficam no trajeto até a cidade mais distante selecionada</small>
                </div>
              </label>
            </div>

            {/* Período */}
            <div className="autoAdjustSection">
              <div className="autoAdjustSectionTitle"><Clock3 size={15} /> Período de execução</div>
              <div className="autoAdjustRow">
                <label>
                  <span>Intervalo (minutos)</span>
                  <input type="number" min={5} max={1440} value={config.timeIntervalMinutes}
                    onChange={(e) => setC('timeIntervalMinutes', Math.max(5, Number(e.target.value)))} />
                </label>
                <label>
                  <span>Início</span>
                  <TimePickerInput value={config.timeStart} onChange={(v) => setC('timeStart', v)} />
                </label>
                <label>
                  <span>Fim</span>
                  <TimePickerInput value={config.timeEnd} onChange={(v) => setC('timeEnd', v)} />
                </label>
              </div>
            </div>

            {/* Vínculos vendedor-cliente/cidade */}
            <div className="autoAdjustSection">
              <div className="autoAdjustSectionTitle"><UserRound size={15} /> Vínculo vendedor → cliente / cidade</div>
              <p style={{ fontSize: '.83rem', color: 'var(--muted)', fontWeight: 600, margin: '0 0 12px' }}>
                Defina quais clientes ou cidades são sempre atendidos por um vendedor específico
              </p>

              <div className="autoAdjustBindingForm">
                <CustomSelect
                  value={bindingForm.sellerId}
                  onChange={(v) => setBindingForm((p) => ({ ...p, sellerId: v }))}
                  placeholder="Vendedor"
                  options={sellers.map((s) => ({ value: String(s.id), label: s.name }))}
                  dropUp
                />
                <div className="autoAdjustBindingType">
                  <button className={bindingForm.type === 'city' ? 'active' : ''} onClick={() => setBindingForm((p) => ({ ...p, type: 'city' }))}>Cidade</button>
                  <button className={bindingForm.type === 'client' ? 'active' : ''} onClick={() => setBindingForm((p) => ({ ...p, type: 'client' }))}>Cliente</button>
                </div>
                {bindingForm.type === 'city' ? (
                  <div className="autoAdjustCityWrap" ref={cityRef}>
                    <input placeholder="Buscar cidade..." value={citySearch}
                      onChange={(e) => { setCitySearch(e.target.value); setShowCitySugg(true) }}
                      onFocus={() => setShowCitySugg(true)}
                      onBlur={() => setTimeout(() => setShowCitySugg(false), 150)} />
                    {showCitySugg && citySugg.length > 0 && (
                      <div className="autoAdjustSugg">
                        {citySugg.map((c) => <button key={c} type="button" onMouseDown={() => { setCitySearch(c); setShowCitySugg(false) }}>{c}</button>)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="autoAdjustCityWrap" ref={clientRef}>
                    <input placeholder="Buscar cliente..." value={clientSearch}
                      onChange={(e) => { setClientSearch(e.target.value); setShowClientSugg(true) }}
                      onFocus={() => setShowClientSugg(true)}
                      onBlur={() => setTimeout(() => setShowClientSugg(false), 150)} />
                    {showClientSugg && clientSugg.length > 0 && (
                      <div className="autoAdjustSugg">
                        {clientSugg.map((c) => <button key={c.id} type="button" onMouseDown={() => { setClientSearch(c.establishmentName); setShowClientSugg(false) }}>{c.establishmentName}</button>)}
                      </div>
                    )}
                  </div>
                )}
                <button className="autoAdjustAddBinding" onClick={addBinding}><Plus size={15} /></button>
              </div>

              {bindings.length > 0 && (
                <div className="autoAdjustBindingList">
                  {bindings.map((b, i) => (
                    <div key={i} className="autoAdjustBindingItem">
                      <UserRound size={13} />
                      <span className="autoAdjustBindingSellerName">{b.sellerName}</span>
                      <span className="autoAdjustBindingArrow">→</span>
                      <span className={`autoAdjustBindingBadge ${b.bindingType}`}>{b.bindingType === 'city' ? <MapPin size={11} /> : <Building2 size={11} />}{b.bindingValue}</span>
                      <button onClick={() => removeBinding(i)}><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="autoAdjustFooter">
          <button className="autoAdjustSaveBtn" onClick={() => handleSave()} disabled={saving || loading || !isDirty}>
            {saving ? <><Loader2 size={15} className="verNotaDetailsSpinner" /> Salvando...</> : 'Salvar'}
          </button>
          <button className="autoAdjustActivateBtn" onClick={handleActivate} disabled={activating || loading}>
            {activating
              ? <><Loader2 size={15} className="verNotaDetailsSpinner" /> {isActive ? 'Desativando...' : 'Ativando...'}</>
              : isActive ? <><X size={15} /> Desativar automação</> : <><Sparkles size={15} /> Ativar automação</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

function Automation({ aiEnabled, setAiEnabled, notify, receiveOrdersActive, setReceiveOrdersActive }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)

  const automations = [
    ['Receber pedidos do app', 'Captura solicitações, organiza itens e direciona para separação.', true],
    ['Sugerir reposição de estoque', 'Analisa mínimo, giro e produtos em atenção.', true],
    ['Gerar nota fiscal demo', 'Prepara dados fiscais do pedido antes da emissão.', true],
    ['Otimizar rotas de entrega', 'Agrupa regiões, horários e veículos refrigerados.', true],
    ['Comunicar fornecedores', 'Monta mensagens de cotação e reposição.', false],
    ['Acompanhar clientes parados', 'Identifica clientes que podem receber nova oferta.', true],
  ]

  const handleCardClick = (title) => {
    if (title === 'Receber pedidos do app') setDialogOpen(true)
  }

  const handleActivateToggle = async () => {
    const newVal = !receiveOrdersActive
    try {
      const res = await fetch(`${API_URL}/api/automation-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'receive_orders', config: { isActive: newVal } }),
      })
      if (res.ok) {
        setReceiveOrdersActive(newVal)
        notify(newVal ? 'Automação "Receber pedidos do app" ativada.' : 'Automação desativada.')
      }
    } catch { notify('Erro ao alterar status da automação.') }
    setDialogOpen(false)
    setAdjustOpen(false)
  }

  const isCardActive = (title) => {
    if (title === 'Receber pedidos do app') return receiveOrdersActive
    return aiEnabled
  }

  return (
    <>
      <section className="pageStack">
        <div className="sectionHeader"><div><p>Configurações inteligentes do sistema</p></div><label className="switch big"><input type="checkbox" checked={aiEnabled} onChange={() => setAiEnabled(!aiEnabled)} /><span></span></label></div>
        <div className="automationHero">
          <div><Bot size={34} /><h2>{aiEnabled ? 'Automação ativa na operação' : 'Operação manual ativada'}</h2><p>Controle como o painel apoia pedidos, estoque, compras, notas, fornecedores, clientes e entregas.</p></div>
          <button onClick={() => notify('Rotina demonstrativa executada com sucesso.')}>Executar rotina agora</button>
        </div>
        <div className="automationGrid">
          {automations.map(([title, text, available]) => (
            <article
              key={title}
              className={isCardActive(title) ? 'on' : ''}
              style={{ cursor: title === 'Receber pedidos do app' ? 'pointer' : undefined }}
              onClick={() => handleCardClick(title)}
            >
              <Settings2 size={22} />
              <div><h3>{title}</h3><p>{text}</p></div>
              <span>{isCardActive(title) ? 'Ativo' : 'Manual'}</span>
            </article>
          ))}
        </div>
      </section>

      {dialogOpen && (
        <AutomationActionDialog
          automation="Receber pedidos do app"
          isActive={receiveOrdersActive}
          onClose={() => setDialogOpen(false)}
          onActivate={handleActivateToggle}
          onAdjust={() => { setDialogOpen(false); setAdjustOpen(true) }}
        />
      )}

      {adjustOpen && (
        <AutomationAdjustModal
          isActive={receiveOrdersActive}
          onClose={() => setAdjustOpen(false)}
          onActivate={handleActivateToggle}
          notify={notify}
        />
      )}
    </>
  )
}

function DateTimePicker({ value, onChange, placeholder = 'Selecionar data e hora', minDate = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const parsedDate = value ? value.slice(0, 10) : ''
  const parsedTime = value ? value.slice(11, 16) : '08:00'

  const [viewYear, setViewYear] = useState(() => parsedDate ? parseInt(parsedDate.slice(0, 4)) : new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => parsedDate ? parseInt(parsedDate.slice(5, 7)) - 1 : new Date().getMonth())
  const [selDate, setSelDate] = useState(parsedDate)
  const [selTime, setSelTime] = useState(parsedTime)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  const handleDayClick = (day) => {
    const d = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSelDate(d)
    onChange(`${d}T${selTime}`)
  }

  const handleTimeChange = (t) => {
    setSelTime(t)
    if (selDate) onChange(`${selDate}T${t}`)
  }

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const DAYS_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  const today = new Date().toISOString().slice(0, 10)
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells = Array(firstDayOfMonth).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))

  const formatDisplay = (val) => {
    if (!val) return ''
    const [datePart, timePart] = val.split('T')
    if (!datePart) return ''
    const [y, m, d] = datePart.split('-')
    return `${d}/${m}/${y}${timePart ? ` às ${timePart}` : ''}`
  }

  return (
    <div className="dtpWrapper" ref={ref}>
      <button
        type="button"
        className={`dtpTrigger${open ? ' open' : ''}`}
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v) }}
      >
        <CalendarDays size={16} style={{ color: 'var(--orange)', flexShrink: 0 }} />
        <span className={!value ? 'dtpPlaceholder' : ''}>{value ? formatDisplay(value) : placeholder}</span>
        {value && (
          <button type="button" className="dtpClearBtn" onClick={(e) => { e.stopPropagation(); onChange(''); setSelDate('') }}>
            <X size={13} />
          </button>
        )}
        <ChevronDown size={14} style={{ marginLeft: 'auto', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {open && (
        <div className="dtpDropdown">
          <div className="dtpCalHeader">
            <button type="button" className="dtpNavBtn" onClick={prevMonth}>
              <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <span className="dtpMonthLabel">{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" className="dtpNavBtn" onClick={nextMonth}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="dtpDayNames">
            {DAYS_SHORT.map((d) => <span key={d}>{d}</span>)}
          </div>

          <div className="dtpCalGrid">
            {cells.map((day, i) => {
              if (!day) return <span key={`e${i}`} />
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isSelected = dateStr === selDate
              const isToday = dateStr === today
              const isPast = !!minDate && dateStr < minDate
              return (
                <button
                  key={dateStr}
                  type="button"
                  className={`dtpDay${isSelected ? ' selected' : ''}${isToday && !isSelected ? ' today' : ''}${isPast ? ' past' : ''}`}
                  onClick={() => !isPast && handleDayClick(day)}
                  disabled={isPast}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="dtpTimePicker">
            <Clock3 size={14} style={{ color: 'var(--orange)', flexShrink: 0 }} />
            <span>Horário</span>
            <input
              type="time"
              value={selTime}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="dtpTimeInput"
            />
          </div>

          {selDate && (
            <div className="dtpConfirmRow">
              <span>{formatDisplay(`${selDate}T${selTime}`)}</span>
              <button type="button" className="dtpConfirmBtn" onClick={() => setOpen(false)}>
                <CheckCircle2 size={14} /> Confirmar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TimePickerInput({ value = '08:00', onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const parts = (value || '08:00').split(':')
  const h = parseInt(parts[0]) || 0
  const m = parseInt(parts[1]) || 0

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const update = (newH, newM) => onChange(`${String(newH).padStart(2,'0')}:${String(newM).padStart(2,'0')}`)

  return (
    <div className="dtpWrapper" ref={ref}>
      <button
        type="button"
        className={`dtpTrigger${open ? ' open' : ''}`}
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v) }}
      >
        <Clock3 size={16} style={{ color: 'var(--orange)', flexShrink: 0 }} />
        <span>{value || '08:00'}</span>
        <ChevronDown size={14} style={{ marginLeft: 'auto', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div className="dtpDropdown tpDropdown">
          <p className="tpLabel">Selecionar horário</p>
          <div className="tpWheels">
            <div className="tpWheel">
              <button type="button" className="tpArrow" onClick={() => update((h + 1) % 24, m)}><ChevronUp size={18} /></button>
              <span className="tpVal">{String(h).padStart(2,'0')}</span>
              <button type="button" className="tpArrow" onClick={() => update((h - 1 + 24) % 24, m)}><ChevronDown size={18} /></button>
            </div>
            <span className="tpColon">:</span>
            <div className="tpWheel">
              <button type="button" className="tpArrow" onClick={() => update(h, (m + 5) % 60)}><ChevronUp size={18} /></button>
              <span className="tpVal">{String(m).padStart(2,'0')}</span>
              <button type="button" className="tpArrow" onClick={() => update(h, (m - 5 + 60) % 60)}><ChevronDown size={18} /></button>
            </div>
          </div>
          <button type="button" className="dtpConfirmBtn tpConfirmBtn" onClick={() => setOpen(false)}>
            <CheckCircle2 size={14} /> Confirmar
          </button>
        </div>
      )}
    </div>
  )
}

function CustomSelect({ value, onChange, options = [], placeholder = 'Selecione...', disabled = false, dropUp = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = options.find((o) => String(o.value) === String(value))

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="productSelectWrap" ref={ref}>
      <button type="button" className={`productSelectBtn${open ? ' open' : ''}`} onClick={() => !disabled && setOpen((v) => !v)} disabled={disabled}>
        <span className={selected ? '' : 'productSelectPlaceholder'}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
      </button>
      {open && (
        <div className="productSelectDropdown" style={dropUp ? { top: 'auto', bottom: 'calc(100% + 6px)' } : undefined}>
          {options.length === 0 && <p className="productSelectEmpty">Nenhuma opção disponível</p>}
          {options.map((o) => (
            <button key={o.value} type="button" className={String(value) === String(o.value) ? 'active' : ''} onClick={() => { onChange(o.value); setOpen(false) }}>
              <span className="productSelectName">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ProductSelect({ value, onChange, disabled, products: productList = [] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const availableProducts = productList.filter((p) => p.stock > 0)
  const selected = productList.find((p) => p.id === value)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="productSelectWrap" ref={ref}>
      <button type="button" className={`productSelectBtn${open ? ' open' : ''}`} onClick={() => !disabled && setOpen((v) => !v)} disabled={disabled}>
        <span className={selected ? '' : 'productSelectPlaceholder'}>{selected ? selected.name : 'Selecione o produto'}</span>
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
      </button>
      {open && (
        <div className="productSelectDropdown">
          {availableProducts.length === 0 && <p className="productSelectEmpty">Nenhum produto em estoque</p>}
          {availableProducts.map((p) => (
            <button key={p.id} type="button" className={value === p.id ? 'active' : ''} onClick={() => { onChange(p.id); setOpen(false) }}>
              <span className="productSelectName">{p.name}</span>
              <span className="productSelectStock">{p.stock} {p.unit}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NewOrderModal({ onClose, onCreateOrder, onUpdateOrder, editOrder, clients = [], lockedEdit = false, notesOnlyEdit = false, products = [], automationLockClient = false }) {
  const [selectedClientId, setSelectedClientId] = useState(() => {
    if (editOrder) {
      const match = clients.find((c) => c.establishmentName === editOrder.customer)
      return match ? String(match.id) : ''
    }
    return ''
  })
  const [form, setForm] = useState(() => editOrder ? {
    customer: editOrder.customer || '',
    cnpj: editOrder.cnpj || '',
    city: editOrder.city || '',
    whatsapp: editOrder.whatsapp || '',
    priority: editOrder.priority || 'Normal',
    delivery: editOrder.delivery || '',
    notes: editOrder.notes || '',
  } : {
    customer: '',
    cnpj: '',
    city: '',
    whatsapp: '',
    priority: 'Normal',
    delivery: '',
    notes: '',
  })
  const [items, setItems] = useState(() => {
    if (editOrder && editOrder.products?.length > 0) {
      return editOrder.products.map((p) => {
        const product = products.find((pr) => pr.name === p.name)
        return { productId: product ? product.id : null, qty: p.qty }
      })
    }
    return [{ productId: null, qty: 0 }]
  })
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const addItem = () => setItems((i) => [...i, { productId: null, qty: 0 }])
  const removeItem = (idx) => setItems((i) => i.filter((_, j) => j !== idx))
  const updateItem = (idx, field, value) =>
    setItems((i) => i.map((item, j) => (j === idx ? { ...item, [field]: value } : item)))

  const handleClientSelect = (id) => {
    setSelectedClientId(id)
    const client = clients.find((c) => String(c.id) === String(id))
    if (client) {
      setForm((f) => ({
        ...f,
        customer: client.establishmentName || '',
        cnpj: client.cnpj || '',
        city: client.city || '',
        whatsapp: client.contactNumber || '',
      }))
    } else {
      setForm((f) => ({ ...f, customer: '', cnpj: '', city: '', whatsapp: '' }))
    }
  }

  const orderProducts = items
    .filter((item) => item.productId && item.qty > 0)
    .map((item) => {
      const product = products.find((p) => p.id === item.productId)
      return { ...product, qty: item.qty }
    })

  const total = orderProducts.reduce((sum, p) => sum + p.price * p.qty, 0)
  const hasValidProducts = items.some((item) => item.productId && item.qty > 0)
  const canSubmit = notesOnlyEdit ? true : lockedEdit ? form.delivery.trim() !== '' : (selectedClientId !== '' && form.delivery.trim() !== '' && hasValidProducts)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.customer.trim() || submitting) return
    setSubmitError('')
    setSubmitting(true)
    try {
      if (editOrder) {
        const updatedOrder = {
          ...editOrder,
          customer: form.customer,
          cnpj: form.cnpj,
          city: form.city,
          whatsapp: form.whatsapp,
          priority: form.priority,
          delivery: form.delivery,
          notes: form.notes,
          value: total,
          products: orderProducts.map((p) => ({ name: p.name, qty: p.qty, unit: p.unit, price: p.price })),
        }
        const payload = {
          orderId: editOrder.id,
          clientId: selectedClientId ? Number(selectedClientId) : null,
          clientName: form.customer,
          clientCnpj: form.cnpj || null,
          clientCity: form.city || null,
          clientPhone: form.whatsapp || null,
          totalValue: total,
          observations: form.notes || null,
          items: orderProducts.map((p) => ({
            productName: p.name,
            quantity: p.qty,
            unit: p.unit,
            unitPrice: p.price,
          })),
        }
        const res = await fetch(`${API_URL}/api/orders`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar pedido')
        onUpdateOrder(updatedOrder)
        onClose()
        return
      }
      const payload = {
        clientId: selectedClientId ? Number(selectedClientId) : null,
        clientName: form.customer,
        clientCnpj: form.cnpj || null,
        clientCity: form.city || null,
        clientPhone: form.whatsapp || null,
        totalValue: total,
        observations: form.notes || null,
        items: orderProducts.map((p) => ({
          productName: p.name,
          quantity: p.qty,
          unit: p.unit,
          unitPrice: p.price,
        })),
      }
      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar pedido')
      onCreateOrder(data.order)
      onClose()
    } catch (err) {
      setSubmitError(err.message || 'Erro ao criar pedido. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modalBackdrop">
      <div className="detailModal newOrderModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>Pedido {editOrder ? 'existente' : 'manual'}</span>
            <h2>{editOrder ? 'Editar pedido' : 'Novo pedido'}</h2>
            <p>{notesOnlyEdit ? 'Pedido entregue — apenas Observações pode ser editado' : editOrder ? 'Altere os dados do pedido e salve as modificações' : 'Preencha os dados do cliente e os produtos solicitados'}</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <div className="newOrderScrollArea">
            <h3>Dados do cliente</h3>
            <div className="settingsForm">
              <label>Cliente *
                <CustomSelect
                  value={selectedClientId}
                  onChange={(v) => handleClientSelect(v)}
                  disabled={lockedEdit || notesOnlyEdit || automationLockClient}
                  placeholder={clients.length === 0 ? 'Carregando clientes...' : 'Selecione o cliente'}
                  options={clients.map((c) => ({ value: String(c.id), label: `${c.establishmentName}${c.city ? ` — ${c.city}` : ''}` }))}
                />
                {automationLockClient && <small style={{color:'var(--muted)',fontWeight:600,marginTop:4,display:'block'}}>Campo desabilitado — automação 'Receber pedidos do app' está ativada</small>}
              </label>
            </div>
            {selectedClientId && (() => {
              const c = clients.find((cl) => String(cl.id) === String(selectedClientId))
              if (!c) return null
              return (
                <div className="supplierDetailGrid" style={{ marginTop: 10, marginBottom: 4 }}>
                  {(c.cnpj || c.document) && <div className="supplierDetailItem"><span>{c.documentType === 'cpf' ? 'CPF' : 'CNPJ'}</span><b>{c.document || c.cnpj}</b></div>}
                  {c.city && <div className="supplierDetailItem"><span>Cidade</span><b>{c.city}</b></div>}
                  {c.contactNumber && <div className="supplierDetailItem"><span>WhatsApp</span><b>{c.contactNumber}</b></div>}
                </div>
              )
            })()}

            <h3 className="newOrderSectionTitle">Produtos solicitados</h3>
            <div className="newOrderItems">
              {items.map((item, idx) => {
                const product = item.productId ? products.find((p) => p.id === item.productId) : null
                return (
                  <div className="newOrderItem" key={idx}>
                    <ProductSelect
                      value={item.productId}
                      disabled={lockedEdit || notesOnlyEdit}
                      products={products}
                      onChange={(val) => setItems((prev) => prev.map((it, j) => j === idx ? { ...it, productId: val, qty: Math.max(1, it.qty) } : it))}
                    />
                    <input type="number" min={item.productId ? 1 : 0} value={item.qty} disabled={lockedEdit || notesOnlyEdit || !item.productId} onChange={(e) => updateItem(idx, 'qty', Math.max(1, Number(e.target.value)))} />
                    <span className="newOrderUnit">{product ? product.unit : ''}</span>
                    <span className="newOrderItemPrice">{product && item.qty > 0 ? money(product.price * item.qty) : ''}</span>
                    {!lockedEdit && !notesOnlyEdit && items.length > 1 && (
                      <button type="button" className="newOrderRemoveBtn" onClick={() => removeItem(idx)}><X size={14} /></button>
                    )}
                  </div>
                )
              })}
              <button type="button" className="newOrderAddBtn" onClick={addItem} style={(lockedEdit || notesOnlyEdit) ? {display:'none'} : {}}>
                <Plus size={15} /> Adicionar produto
              </button>
            </div>

            <h3 className="newOrderSectionTitle">Detalhes do pedido</h3>
            <div className="settingsForm">
              <label>Prioridade
                <CustomSelect
                  value={form.priority}
                  onChange={(v) => set('priority', v)}
                  disabled={notesOnlyEdit}
                  options={[
                    { value: 'Normal', label: 'Normal' },
                    { value: 'Alta', label: 'Alta' },
                  ]}
                />
              </label>
              <label>Previsão de entrega
                <input placeholder="Hoje, 15:00" value={form.delivery} disabled={notesOnlyEdit} onChange={(e) => set('delivery', e.target.value)} />
              </label>
            </div>

            <div className="noteBox" style={{ marginTop: '16px' }}>
              <b>Observações</b>
              <textarea rows={4} placeholder="Instruções especiais, horário preferido, local..." value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>

          <div className="newOrderFooter">
            <div className="newOrderTotalInline">
              <span>Total estimado</span>
              <strong>{money(total)}</strong>
            </div>
            {submitError && <small className="errorText">{submitError}</small>}
            <div className="newOrderFooterActions">
              <button type="submit" className="btnPrimary" disabled={!canSubmit || submitting}><CheckCircle2 size={17} /> {submitting ? (editOrder ? 'Salvando...' : 'Criando...') : (editOrder ? 'Salvar alterações' : 'Criar pedido')}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function OrderModal({ order, onClose, updateOrderStatus, createInvoice, onRemove, onEdit, canRemove = true, onReactivate = null, receiveOrdersActive = false }) {
  return (
    <div className="modalBackdrop">
      <div className="detailModal orderModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader"><div><span>{order.id}</span><h2>{order.customer}</h2><p>{order.cnpj} • {order.city}</p></div><Status status={order.isDeleted ? 'Removido' : order.status} /></div>
        <div className="orderModalBody">
          <div className="modalSplit">
            <div>
              <h3>Produtos solicitados</h3>
              <div className="modalItems">{order.products.map((p) => <div key={p.name}><span>{p.qty} {p.unit}</span><b>{p.name}</b><strong>{money(p.qty * p.price)}</strong></div>)}</div>
              <div className="noteBox"><b>Observações</b><p>{order.notes}</p></div>
            </div>
            <div className="summaryBox">
              <h3>Resumo</h3>
              <p><b>WhatsApp:</b> {order.whatsapp}</p>
              <p><b>Entrega:</b> {order.delivery}</p>
              <p><b>Valor:</b> {money(order.value)}</p>
            </div>
          </div>
        </div>
        <div className="orderModalFooter">
          {onReactivate && <button className="orderModalBtn orderModalBtnPrimary" style={{background:'var(--green, #22c55e)',borderColor:'var(--green, #22c55e)'}} onClick={onReactivate}>Reativar</button>}
          {!onReactivate && canRemove && (
            receiveOrdersActive && order.status === 'Recebido'
              ? <button className="orderModalBtn orderModalBtnDanger" disabled style={{opacity:0.5,cursor:'not-allowed'}} title="Desabilitado porque a automação 'Receber pedidos do app' está ativada">Remover</button>
              : <button className="orderModalBtn orderModalBtnDanger" onClick={onRemove}>Remover</button>
          )}
          {!onReactivate && <button className="orderModalBtn orderModalBtnPrimary" onClick={onEdit}>Editar</button>}
        </div>
      </div>
    </div>
  )
}

function ProductModal({ product, onClose, onRemove, onEdit }) {
  return (
    <div className="modalBackdrop">
      <div className="productModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="productModalBody">
          {product.image
            ? <img src={product.image} alt={product.name} />
            : <div className="productModalNoImage"><ImageOff size={48} /><span>Sem imagem</span></div>}
          <div className="productModalContent">
            <span className="badge">{product.category}</span>
            <h2>{product.name}{product.showKg ? <small style={{fontWeight:400,marginLeft:8}}>{product.packagingWeight}kg</small> : null}</h2>
            <p>{product.description || 'Produto controlado no estoque da Saborsan com gestão de validade, temperatura, fornecedor, custo e disponibilidade para pedidos do app.'}</p>
            <div className="detailGrid">
              <div><b>Estoque</b><span>{product.stock}{product.unit ? ` ${product.unit}` : ''}</span></div>
              {product.temperature && <div><b>Conservação</b><span>{product.temperature}</span></div>}
              {product.packaging && <div><b>Embalagem</b><span>{product.packaging}</span></div>}
              <div><b>Preço base</b><span>{money(product.price)}</span></div>
              {product.group && <div><b>Grupo</b><span>{product.group}</span></div>}
              {product.subGroup && <div><b>Sub grupo</b><span>{product.subGroup}</span></div>}
              {product.idealFor && <div><b>Indicado para</b><span>{product.idealFor}</span></div>}
              {product.preparation && <div><b>Preparo</b><span>{product.preparation}</span></div>}
            </div>
          </div>
        </div>
        <div className="orderModalFooter">
          <button className="orderModalBtn orderModalBtnDanger" onClick={onRemove}>Remover</button>
          <button className="orderModalBtn orderModalBtnPrimary" onClick={onEdit}>Editar</button>
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
        <div className="modalHeader"><div><span>Comunicação com fornecedor</span><h2>{supplier.name}</h2><p>{supplier.contactName || '—'} • {supplier.contactPhone || '—'}</p></div><MessageCircle /></div>
        <textarea defaultValue={`Olá, ${supplier.contactName || supplier.name}. Tudo bem? Aqui é da Saborsan. Gostaríamos de consultar disponibilidade e prazo para reposição dos produtos relacionados a ${supplier.foodTypes || 'seus produtos'}. Pode nos enviar as condições comerciais atualizadas?`} />
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

function FiscalConfigSection({ notify }) {
  const [loading, setLoading] = useState(false)
  const [configs, setConfigs] = useState([])
  const [products, setProducts] = useState([])
  const [syncStatus, setSyncStatus] = useState(null)
  const [classifyProducts, setClassifyProducts] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [classifyResults, setClassifyResults] = useState(null)
  const [editProduct, setEditProduct] = useState(null)
  const [saving, setSaving] = useState(false)
  const defaultForm = {
    ncm: '21069090', cfop: '5102', icmsOrigin: '0', icmsCst: '400', icmsAliq: '0',
    pisCST: '07', pisAliq: '0', cofinsCST: '07', cofinsAliq: '0',
    ibsCbsCst: '', ibsCbsClassTrib: '', ibsCbsAliqUF: '0', ibsCbsAliqMun: '0', ibsCbsAliqCbs: '0', ibsCbsReducaoAliq: '0',
    fiscalApproved: false, approvedBy: '', notes: ''
  }
  const [form, setForm] = useState(defaultForm)
  const [initialForm, setInitialForm] = useState(null)

  useEffect(() => { loadData() }, [])

  // Capture form snapshot after modal opens; null ensures button is disabled on open
  useEffect(() => {
    if (editProduct) setInitialForm({ ...form })
  }, [editProduct])

  async function loadData() {
    setLoading(true)
    try {
      const [pr, cr, sr, nr] = await Promise.all([
        fetch(`${API_URL}/api/products`),
        fetch(`${API_URL}/api/fiscal-config`),
        fetch(`${API_URL}/api/ncm/sync`),
        fetch(`${API_URL}/api/ncm/classify`),
      ])
      const pd = pr.ok ? await pr.json() : {}
      const cd = cr.ok ? await cr.json() : {}
      const sd = sr.ok ? await sr.json() : null
      const nd = nr.ok ? await nr.json() : null
      setProducts(pd.products || [])
      setConfigs(cd.configs || [])
      setSyncStatus(sd)
      setClassifyProducts(nd?.products || [])
    } catch (_) {}
    finally { setLoading(false) }
  }

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    setClassifyResults(null)
    try {
      const res = await fetch(`${API_URL}/api/ncm/sync`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro na sincronização')
      setSyncStatus(data)
      notify(`Tabela NCM sincronizada: ${data.activeCount?.toLocaleString('pt-BR')} códigos ativos.`)
      await loadData()
    } catch (err) { notify(`Erro: ${err.message}`) }
    finally { setSyncing(false) }
  }

  async function handleClassify() {
    if (classifying) return
    setClassifying(true)
    setClassifyResults(null)
    try {
      const res = await fetch(`${API_URL}/api/ncm/classify`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro na classificação')
      setClassifyResults(data)
      notify(`Classificação concluída: ${data.classified} classificados, ${data.pending} pendentes.`)
      await loadData()
    } catch (err) { notify(`Erro: ${err.message}`) }
    finally { setClassifying(false) }
  }

  function openEdit(product) {
    const cfg = configs.find(c => String(c.productId) === String(product.id) || c.productName?.trim() === product.name?.trim())
    const ncmData = classifyProducts.find(cp => cp.id === product.id || cp.name === product.name)
    const suggestedNcm = ncmData?.ncm || '21069090'
    const nextForm = cfg ? {
      ncm: cfg.ncm || suggestedNcm, cfop: cfg.cfop || '5102',
      icmsOrigin: String(cfg.icmsOrigin ?? 0), icmsCst: cfg.icmsCst || '400',
      icmsAliq: String(cfg.icmsAliq ?? 0), pisCST: cfg.pisCST || '07',
      pisAliq: String(cfg.pisAliq ?? 0), cofinsCST: cfg.cofinsCST || '07',
      cofinsAliq: String(cfg.cofinsAliq ?? 0),
      ibsCbsCst: cfg.ibsCbsCst || '', ibsCbsClassTrib: cfg.ibsCbsClassTrib || '',
      // Se IBS ativo mas alíquota zerada, mostrar o default 2026 que a emissão já usa
      ibsCbsAliqUF: String(Number(cfg.ibsCbsAliqUF) || (cfg.ibsCbsCst ? 0.1 : 0)),
      ibsCbsAliqMun: String(cfg.ibsCbsAliqMun ?? 0),
      ibsCbsAliqCbs: String(Number(cfg.ibsCbsAliqCbs) || (cfg.ibsCbsCst ? 0.9 : 0)),
      ibsCbsReducaoAliq: String(cfg.ibsCbsReducaoAliq ?? 0),
      fiscalApproved: !!cfg.fiscalApproved, approvedBy: cfg.approvedBy || '', notes: cfg.notes || '',
    } : { ...defaultForm, ncm: suggestedNcm }
    setForm(nextForm)
    setInitialForm(null)
    setEditProduct(product)
  }

  async function save() {
    if (!editProduct || saving) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/fiscal-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: editProduct.id, productName: editProduct.name,
          ncm: form.ncm.trim(), cfop: form.cfop.trim(),
          icmsOrigin: Number(form.icmsOrigin), icmsCst: form.icmsCst.trim(),
          icmsAliq: Number(form.icmsAliq), pisCST: form.pisCST.trim(),
          pisAliq: Number(form.pisAliq), cofinsCST: form.cofinsCST.trim(),
          cofinsAliq: Number(form.cofinsAliq),
          ibsCbsCst: form.ibsCbsCst.trim() || null,
          ibsCbsClassTrib: form.ibsCbsClassTrib.trim() || null,
          ibsCbsAliqUF: Number(form.ibsCbsAliqUF), ibsCbsAliqMun: Number(form.ibsCbsAliqMun),
          ibsCbsAliqCbs: Number(form.ibsCbsAliqCbs), ibsCbsReducaoAliq: Number(form.ibsCbsReducaoAliq),
          fiscalApproved: form.fiscalApproved,
          approvedBy: form.approvedBy.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      notify(`Configuração fiscal de "${editProduct.name}" salva.`)
      setEditProduct(null)
      await loadData()
    } catch (_) { notify('Erro ao salvar configuração fiscal.') }
    finally { setSaving(false) }
  }

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const isFormDirty = !!initialForm && Object.keys(form).some(
    k => String(form[k]) !== String(initialForm[k])
  )

  const rows = products.map(p => ({
    product: p,
    config: configs.find(c => String(c.productId) === String(p.id) || c.productName?.trim() === p.name?.trim()),
    ncmData: classifyProducts.find(cp => String(cp.id) === String(p.id) || cp.name?.trim() === p.name?.trim()),
  }))

  const pendingNcmCount = rows.filter(({ config, ncmData }) => {
    const src = config?.ncmSource || ncmData?.ncmSource
    return !src || !['manual', 'ai'].includes(src)
  }).length

  function NcmSourceBadge({ source, confidence }) {
    if (source === 'manual') return <span className="fiscalBadgeOk"><CheckCircle2 size={12} /> Manual</span>
    if (source === 'ai') return (
      <span className="fiscalBadgeOk" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
        <Sparkles size={12} /> IA {confidence ? `${Math.round(confidence)}%` : ''}
      </span>
    )
    return <span className="fiscalBadgeWarn"><AlertTriangle size={12} /> Pendente</span>
  }

  return (
    <>
      <div className="card settingsCard settingsCardFull">
        <div className="cardHeader">
          <div><p>Reforma Tributária · NCM</p><h3>Classificação fiscal e sincronização NCM</h3></div>
          <ReceiptText size={22} />
        </div>
        <div className="settingsInfo" style={{ marginBottom: 12 }}>
          <AlertTriangle size={14} />
          <span>Configure o <b>CST</b> e a <b>Classificação Tributária (cClassTrib)</b> do IBS/CBS para cada produto. Campos obrigatórios para emissão de NF-e conforme LC 214/2024.</span>
        </div>
        <div className="settingsInfo" style={{ marginBottom: 16 }}>
          <Database size={14} />
          <span>A tabela NCM é obtida do Siscomex e sincronizada automaticamente toda segunda-feira às 3h (UTC). Após a sincronização, a IA classifica os produtos sem NCM.</span>
        </div>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-light)', padding: '8px 0' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /><span>Carregando...</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
              <div style={{ flex: 1, minWidth: 140, background: 'var(--bg)', borderRadius: 12, padding: '14px 18px', border: '1.5px solid var(--line)' }}>
                <div style={{ fontSize: '.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Códigos ativos</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>
                  {syncStatus?.activeCount != null ? Number(syncStatus.activeCount).toLocaleString('pt-BR') : '—'}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 140, background: 'var(--bg)', borderRadius: 12, padding: '14px 18px', border: '1.5px solid var(--line)' }}>
                <div style={{ fontSize: '.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Última sincronização</div>
                <div style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--text)' }}>
                  {syncStatus?.lastSyncedAt
                    ? new Date(syncStatus.lastSyncedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Nunca sincronizado'}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 140, background: pendingNcmCount > 0 ? '#fff8f0' : 'var(--bg)', borderRadius: 12, padding: '14px 18px', border: `1.5px solid ${pendingNcmCount > 0 ? '#fcd34d' : 'var(--line)'}` }}>
                <div style={{ fontSize: '.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Produtos sem NCM</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: pendingNcmCount > 0 ? '#b45309' : 'var(--text)' }}>{pendingNcmCount}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <button className="btnSolid" onClick={handleSync} disabled={syncing} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                {syncing
                  ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Sincronizando...</>
                  : <><RefreshCw size={16} /> Sincronizar tabela NCM</>}
              </button>
              <button
                className={pendingNcmCount === 0 ? 'btnOutline' : 'btnSolid'}
                onClick={handleClassify}
                disabled={classifying || !syncStatus?.activeCount}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
              >
                {classifying
                  ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Classificando...</>
                  : <><Wand2 size={16} /> Classificar produtos com IA</>}
              </button>
            </div>
            {!syncStatus?.activeCount && (
              <div className="settingsInfo" style={{ marginBottom: 16, background: '#fff8f0', border: '1px solid #fcd34d' }}>
                <AlertTriangle size={14} color="#b45309" />
                <span>A tabela NCM está vazia. Execute a sincronização antes de classificar produtos.</span>
              </div>
            )}
            {classifyResults && (
              <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 12, background: '#f0fdf4', border: '1.5px solid #86efac' }}>
                <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={15} color="#16a34a" /> Resultado da classificação
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: '.85rem' }}>
                  <span><b style={{ color: '#16a34a' }}>{classifyResults.classified}</b> classificados</span>
                  <span><b style={{ color: '#b45309' }}>{classifyResults.pending}</b> pendentes (baixa confiança)</span>
                  <span><b style={{ color: '#dc2626' }}>{classifyResults.failed}</b> falhas</span>
                </div>
                {classifyResults.results?.filter(r => r.status === 'pending' || r.status === 'failed').length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: 6 }}>Produtos que precisam de revisão manual:</div>
                    {classifyResults.results.filter(r => r.status !== 'classified').map(r => (
                      <div key={r.productId} style={{ fontSize: '.8rem', padding: '4px 0', borderBottom: '1px solid #dcfce7', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <AlertTriangle size={12} color="#b45309" />
                        <span><b>{r.productName}</b> — {r.status === 'failed' ? (r.reason || 'Falha') : `Confiança ${r.confidence}% — ${r.justification || ''}`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="fiscalConfigTable">
              <div className="fiscalConfigHead">
                <span>Produto</span><span>NCM</span><span>Origem NCM</span><span>CST IBS/CBS</span><span>cClassTrib</span><span>Status fiscal</span>
              </div>
              {rows.length === 0 && <div style={{ padding: '12px 0', color: 'var(--text-light)', fontSize: '.88rem' }}>Nenhum produto cadastrado.</div>}
              {rows.map(({ product, config, ncmData }) => {
                const fiscalOk = config && config.ibsCbsCst
                const effectiveNcm = config?.ncm || ncmData?.ncm || '21069090'
                const effectiveNcmSource = config?.ncmSource || ncmData?.ncmSource
                const effectiveNcmConfidence = config?.ncmConfidence || ncmData?.ncmConfidence
                return (
                  <div key={product.id} className="fiscalConfigRow">
                    <span className="fiscalProdName">{product.name}</span>
                    <span className="fiscalCode" style={!config?.ncm && !ncmData?.ncm ? { color: 'var(--text-light)' } : undefined}>{effectiveNcm}</span>
                    <span><NcmSourceBadge source={effectiveNcmSource} confidence={effectiveNcmConfidence} /></span>
                    <span className="fiscalCode">{config?.ibsCbsCst || '—'}</span>
                    <span className="fiscalCode">{config?.ibsCbsClassTrib || '—'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      {fiscalOk
                        ? <span className="fiscalBadgeOk"><CheckCircle2 size={12} /> Configurado</span>
                        : <span className="fiscalBadgeWarn"><AlertTriangle size={12} /> IBS/CBS pendente</span>
                      }
                      <button style={{ border: 0, background: 'var(--orange)', color: '#fff', borderRadius: '999px', padding: '8px 12px', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }} onClick={() => openEdit(product)}><ClipboardEdit size={13} /> Editar</button>
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {editProduct && (
        <div className="modalBackdrop">
          <div className="detailModal newOrderModal" style={{ maxWidth: 580 }}>
            <button className="closeBtn" onClick={() => setEditProduct(null)}><X /></button>
            <div className="modalHeader">
              <div><span>Configuração Fiscal</span><h2>{editProduct.name}</h2><p>Defina os dados tributários para emissão de NF-e</p></div>
            </div>
            <div className="newOrderScrollArea">
              <div style={{ background: '#fff8f0', border: '1.5px solid #ffd89b', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={16} color="#b45309" /> IBS/CBS — Reforma Tributária <span style={{ background: '#f97316', color: '#fff', fontSize: '.68rem', fontWeight: 900, padding: '2px 7px', borderRadius: 999, marginLeft: 4 }}>obrigatório</span></h3>
                <div className="settingsForm settingsTwoCols">
                  <label>CST IBS/CBS *<input placeholder="Ex: 40" value={form.ibsCbsCst} onChange={e => setF('ibsCbsCst', e.target.value)} maxLength={5} /></label>
                  <label>Classificação Tributária (cClassTrib) *<input placeholder="Ex: 01.001" value={form.ibsCbsClassTrib} onChange={e => setF('ibsCbsClassTrib', e.target.value)} maxLength={10} /></label>
                  <label>Alíquota IBS Estado (%)<input type="number" step="0.0001" min="0" value={form.ibsCbsAliqUF} onChange={e => setF('ibsCbsAliqUF', e.target.value)} /></label>
                  <label>Alíquota IBS Município (%)<input type="number" step="0.0001" min="0" value={form.ibsCbsAliqMun} onChange={e => setF('ibsCbsAliqMun', e.target.value)} /></label>
                  <label>Alíquota CBS (%)<input type="number" step="0.0001" min="0" value={form.ibsCbsAliqCbs} onChange={e => setF('ibsCbsAliqCbs', e.target.value)} /></label>
                  <label>% Redução de alíquota (IBS/CBS)<input type="number" step="0.01" min="0" max="100" placeholder="Ex: 60" value={form.ibsCbsReducaoAliq} onChange={e => setF('ibsCbsReducaoAliq', e.target.value)} /></label>
                </div>
              </div>

              <h3 style={{ margin: '0 0 10px', fontSize: '.88rem' }}>Classificação básica</h3>
              <div className="settingsForm settingsTwoCols">
                <label>NCM<input placeholder="Ex: 19059090" value={form.ncm} onChange={e => setF('ncm', e.target.value)} maxLength={10} /></label>
                <label>CFOP<input placeholder="Ex: 5102" value={form.cfop} onChange={e => setF('cfop', e.target.value)} maxLength={5} /></label>
              </div>

              <h3 style={{ margin: '16px 0 10px', fontSize: '.88rem' }}>ICMS</h3>
              <div className="settingsForm settingsTwoCols">
                <label>CST ICMS<input placeholder="Ex: 400" value={form.icmsCst} onChange={e => setF('icmsCst', e.target.value)} maxLength={5} /></label>
                <label>Alíquota ICMS (%)<input type="number" step="0.01" min="0" value={form.icmsAliq} onChange={e => setF('icmsAliq', e.target.value)} /></label>
              </div>

              <h3 style={{ margin: '16px 0 10px', fontSize: '.88rem' }}>PIS / COFINS</h3>
              <div className="settingsForm settingsTwoCols">
                <label>CST PIS<input placeholder="Ex: 07" value={form.pisCST} onChange={e => setF('pisCST', e.target.value)} maxLength={3} /></label>
                <label>Alíquota PIS (%)<input type="number" step="0.01" min="0" value={form.pisAliq} onChange={e => setF('pisAliq', e.target.value)} /></label>
                <label>CST COFINS<input placeholder="Ex: 07" value={form.cofinsCST} onChange={e => setF('cofinsCST', e.target.value)} maxLength={3} /></label>
                <label>Alíquota COFINS (%)<input type="number" step="0.01" min="0" value={form.cofinsAliq} onChange={e => setF('cofinsAliq', e.target.value)} /></label>
              </div>

              <h3 style={{ margin: '16px 0 10px', fontSize: '.88rem' }}>Controle</h3>
              <div className="settingsForm">
                <label>Validado pelo contador<input placeholder="Nome do responsável" value={form.approvedBy} onChange={e => setF('approvedBy', e.target.value)} /></label>
                <label>Observações<textarea rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} style={{ resize: 'vertical', width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--line)', fontSize: '.88rem', fontFamily: 'inherit' }} /></label>
              </div>
              <div className="settingsToggleRow" style={{ marginTop: 10 }}>
                <span>Aprovado pelo contador</span>
                <label className="switch"><input type="checkbox" checked={form.fiscalApproved} onChange={() => setF('fiscalApproved', !form.fiscalApproved)} /><span></span></label>
              </div>
            </div>
            <div className="orderModalFooter">
              <button className="btnSolid" onClick={save} disabled={saving || !isFormDirty} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><CheckCircle2 size={16} /> Salvar configuração</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Settings({ notify, onNotifSettingChange }) {
  const [form, setForm] = useState(() => {
    try {
      const stored = localStorage.getItem('saborsan_settings')
      const saved = stored ? JSON.parse(stored) : {}
      return {
        empresa: 'Saborsan Distribuidora',
        cnpj: '05.533.744/0001-95',
        email: 'contato@saborsan.com.br',
        telefone: '(49) 3224-0000',
        cidade: 'Lages - SC',
        tempMin: '-20',
        tempMax: '-15',
        estoqueAlerta: '10',
        compraPadraoHora: '09:00',
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
        estoqueIaWhatsapp: false,
        estoqueWhatsappNumeros: [],
        compraDatas: [],
        iaFornecedorPrompt: 'Você é um assistente de compras da Saborsan Distribuidora. Ao contatar fornecedores, seja cordial, objetivo e profissional. Solicite cotações de preço, prazo de entrega e condições de pagamento. Priorize fornecedores com melhor custo-benefício e histórico de pontualidade. Confirme disponibilidade de estoque antes de fechar pedido.',
        iaImportPrompt: '',
        notifOrders: true,
        notifSellers: true,
        notifFiscalDocuments: true,
        notifStock: true,
        notifSuppliers: true,
        notifPurchases: true,
        notifDeliveries: true,
        notifClients: true,
        notifPayments: true,
        ...saved,
      }
    } catch {
      return {
        empresa: 'Saborsan Distribuidora',
        cnpj: '05.533.744/0001-95',
        email: 'contato@saborsan.com.br',
        telefone: '(49) 3224-0000',
        cidade: 'Lages - SC',
        tempMin: '-20',
        tempMax: '-15',
        estoqueAlerta: '10',
        compraPadraoHora: '09:00',
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
        estoqueIaWhatsapp: false,
        estoqueWhatsappNumeros: [],
        compraDatas: [],
        iaFornecedorPrompt: 'Você é um assistente de compras da Saborsan Distribuidora. Ao contatar fornecedores, seja cordial, objetivo e profissional. Solicite cotações de preço, prazo de entrega e condições de pagamento. Priorize fornecedores com melhor custo-benefício e histórico de pontualidade. Confirme disponibilidade de estoque antes de fechar pedido.',
        iaImportPrompt: '',
        notifOrders: true,
        notifSellers: true,
        notifFiscalDocuments: true,
        notifStock: true,
        notifSuppliers: true,
        notifPurchases: true,
        notifDeliveries: true,
        notifClients: true,
        notifPayments: true,
      }
    }
  })

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const snapOperacao = (f) => JSON.stringify({
    estoqueAlerta:          String(f.estoqueAlerta),
    estoqueIaWhatsapp:      !!f.estoqueIaWhatsapp,
    compraDatas:            f.compraDatas            || [],
    estoqueWhatsappNumeros: f.estoqueWhatsappNumeros || [],
    iaFornecedorPrompt:     f.iaFornecedorPrompt,
    iaImportPrompt:         f.iaImportPrompt         || '',
    iaLigarModo:            f.iaLigarModo            || 'ia',
    iaLigarDia:             f.iaLigarDia             || 'segunda',
    iaLigarHora:            f.iaLigarHora            || '09:00',
  })
  const [savedOperacaoSnap, setSavedOperacaoSnap] = useState(() => snapOperacao(form))

  const snapRelatorios = (f) => JSON.stringify({
    relatorioEmail: f.relatorioEmail || '',
    relatorioFreq:  f.relatorioFreq  || 'desativado',
    relatorioDia:   f.relatorioDia   || '1',
    relatorioHora:  f.relatorioHora  || '08:00',
  })
  const [savedRelatoriosSnap, setSavedRelatoriosSnap] = useState(() => snapRelatorios(form))

  useEffect(() => {
    fetch(`${API_URL}/api/stock-purchase-config`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setForm((f) => ({
          ...f,
          estoqueAlerta:          String(data.stockAlertPct ?? f.estoqueAlerta),
          estoqueIaWhatsapp:      !!data.iaWhatsapp,
          iaFornecedorPrompt:     data.iaPrompt        || f.iaFornecedorPrompt,
          iaImportPrompt:         data.iaImportPrompt  || f.iaImportPrompt,
          compraDatas:            data.purchaseSchedules ?? f.compraDatas,
          estoqueWhatsappNumeros: data.whatsappNumbers   ?? f.estoqueWhatsappNumeros,
          iaLigarModo:            data.iaLigarModo       ?? f.iaLigarModo,
          iaLigarDia:             data.iaLigarDia        ?? f.iaLigarDia,
          iaLigarHora:            data.iaLigarHora       ?? f.iaLigarHora,
        }));
        setSavedOperacaoSnap(JSON.stringify({
          estoqueAlerta:          String(data.stockAlertPct),
          estoqueIaWhatsapp:      !!data.iaWhatsapp,
          compraDatas:            data.purchaseSchedules || [],
          estoqueWhatsappNumeros: data.whatsappNumbers   || [],
          iaFornecedorPrompt:     data.iaPrompt          || '',
          iaImportPrompt:         data.iaImportPrompt    || '',
          iaLigarModo:            data.iaLigarModo       || 'ia',
          iaLigarDia:             data.iaLigarDia        || 'segunda',
          iaLigarHora:            data.iaLigarHora       || '09:00',
        }));
      })
      .catch(() => {});

    fetch(`${API_URL}/api/notification-settings`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setForm((f) => ({
          ...f,
          notifOrders:          data.notifOrders          ?? f.notifOrders,
          notifSellers:         data.notifSellers         ?? f.notifSellers,
          notifFiscalDocuments: data.notifFiscalDocuments ?? f.notifFiscalDocuments,
          notifStock:           data.notifStock           ?? f.notifStock,
          notifSuppliers:       data.notifSuppliers       ?? f.notifSuppliers,
          notifPurchases:       data.notifPurchases       ?? f.notifPurchases,
          notifDeliveries:      data.notifDeliveries      ?? f.notifDeliveries,
          notifClients:         data.notifClients         ?? f.notifClients,
        }));
      })
      .catch(() => {});

    fetch(`${API_URL}/api/report-settings`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setForm((f) => ({
          ...f,
          relatorioEmail:      data.relatorioEmail      ?? f.relatorioEmail,
          relatorioFreq:       data.relatorioFreq       ?? f.relatorioFreq,
          relatorioDia:        data.relatorioDia        ?? f.relatorioDia,
          relatorioHora:       data.relatorioHora       ?? f.relatorioHora,
          relatorioVendas:     data.relatorioVendas     ?? f.relatorioVendas,
          relatorioEstoque:    data.relatorioEstoque    ?? f.relatorioEstoque,
          relatorioFinanceiro: data.relatorioFinanceiro ?? f.relatorioFinanceiro,
          relatorioEntregas:   data.relatorioEntregas   ?? f.relatorioEntregas,
        }));
        setSavedRelatoriosSnap(JSON.stringify({
          relatorioEmail: data.relatorioEmail || '',
          relatorioFreq:  data.relatorioFreq  || 'desativado',
          relatorioDia:   data.relatorioDia   || '1',
          relatorioHora:  data.relatorioHora  || '08:00',
        }));
      })
      .catch(() => {});
  }, []);

  const saveSettings = async () => {
    try {
      localStorage.setItem('saborsan_settings', JSON.stringify(form))
      localStorage.setItem('saborsan_purchase_default_time', form.compraPadraoHora)
    } catch {}

    if (activeSection === 'operacao') {
      try {
        const saved = JSON.parse(savedOperacaoSnap)
        const patch = {}
        if (String(form.estoqueAlerta) !== String(saved.estoqueAlerta))
          patch.stockAlertPct = parseFloat(form.estoqueAlerta) || 10
        if (!!form.estoqueIaWhatsapp !== !!saved.estoqueIaWhatsapp)
          patch.iaWhatsapp = !!form.estoqueIaWhatsapp
        if (form.iaFornecedorPrompt !== saved.iaFornecedorPrompt)
          patch.iaPrompt = form.iaFornecedorPrompt
        if (form.iaImportPrompt !== saved.iaImportPrompt)
          patch.iaImportPrompt = form.iaImportPrompt
        if (JSON.stringify(form.compraDatas || []) !== JSON.stringify(saved.compraDatas || []))
          patch.purchaseSchedules = form.compraDatas || []
        if (JSON.stringify(form.estoqueWhatsappNumeros || []) !== JSON.stringify(saved.estoqueWhatsappNumeros || []))
          patch.whatsappNumbers = form.estoqueWhatsappNumeros || []
        if ((form.iaLigarModo || 'ia') !== (saved.iaLigarModo || 'ia'))
          patch.iaLigarModo = form.iaLigarModo || 'ia'
        if ((form.iaLigarDia || 'segunda') !== (saved.iaLigarDia || 'segunda'))
          patch.iaLigarDia = form.iaLigarDia || 'segunda'
        if ((form.iaLigarHora || '09:00') !== (saved.iaLigarHora || '09:00'))
          patch.iaLigarHora = form.iaLigarHora || '09:00'
        if (Object.keys(patch).length > 0) {
          await fetch(`${API_URL}/api/stock-purchase-config`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          })
        }
        setSavedOperacaoSnap(snapOperacao(form));
      } catch {}
    }

    if (activeSection === 'relatorios') {
      try {
        const saved = JSON.parse(savedRelatoriosSnap)
        const patch = {}
        if (form.relatorioEmail !== saved.relatorioEmail) patch.relatorioEmail = form.relatorioEmail
        if (form.relatorioFreq  !== saved.relatorioFreq)  patch.relatorioFreq  = form.relatorioFreq
        if (form.relatorioDia   !== saved.relatorioDia)   patch.relatorioDia   = form.relatorioDia
        if (form.relatorioHora  !== saved.relatorioHora)  patch.relatorioHora  = form.relatorioHora
        if (Object.keys(patch).length > 0) {
          await fetch(`${API_URL}/api/report-settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          })
        }
        setSavedRelatoriosSnap(snapRelatorios(form));
      } catch {}
    }

    notify('Configurações salvas com sucesso.')
  }

  const settingsSections = [
    { id: 'empresa',       label: 'Dados da empresa',      icon: Building2  },
    { id: 'operacao',      label: 'Estoque e fornecedores', icon: Boxes      },
    { id: 'notificacoes',  label: 'Notificações',          icon: Bell       },
    { id: 'relatorios',    label: 'Relatórios',            icon: BarChart3  },
    { id: 'fiscal',        label: 'Fiscal e NCM',          icon: ReceiptText },
  ]

  const [activeSection, setActiveSection] = useState('empresa')
  const active = settingsSections.find((s) => s.id === activeSection)
  const showSaveBtn = activeSection !== 'fiscal' && activeSection !== 'empresa' && activeSection !== 'notificacoes'
  const operacaoDirty = activeSection !== 'operacao' || snapOperacao(form) !== savedOperacaoSnap
  const relatoriosDirty = activeSection !== 'relatorios' || snapRelatorios(form) !== savedRelatoriosSnap

  return (
    <>
      <div className="sectionHeader" style={{ marginBottom: '20px' }}>
        <div><p>Preferências e configurações do sistema</p></div>
      </div>
      <div className="settingsLayout">
        <nav className="settingsSubNav">
          {settingsSections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`settingsSubNavItem${activeSection === id ? ' active' : ''}`}
              onClick={() => setActiveSection(id)}
            >
              <span className="settingsSubNavIcon"><Icon size={16} /></span>
              <span className="settingsSubNavLabel"><b>{label}</b></span>
            </button>
          ))}
        </nav>

      <div className="settingsSectionContent">
        <div className="settingsSectionInner" style={showSaveBtn ? { paddingBottom: '80px' } : undefined}>

          {activeSection === 'empresa' && (
            <div className="card settingsCard">
              <div className="cardHeader"><div><p>Identidade</p><h3>Dados da empresa</h3></div><Building2 size={22} /></div>
              <div className="settingsForm">
                <label>Nome da empresa<input value={form.empresa} readOnly /></label>
                <label>CNPJ<input value={form.cnpj} readOnly /></label>
                <label>E-mail corporativo<input value={form.email} readOnly /></label>
                <label>Telefone<input value={form.telefone} readOnly /></label>
                <label>Cidade / UF<input value={form.cidade} readOnly /></label>
              </div>
            </div>
          )}

          {activeSection === 'operacao' && (
            <div className="card settingsCard">
              <div className="cardHeader"><div><p>Operação</p><h3>Estoque e fornecedores</h3></div><Boxes size={22} /></div>
              <div className="settingsForm">
                <label>Alertar estoque quando abaixo de (%)<input type="number" value={form.estoqueAlerta} onChange={(e) => set('estoqueAlerta', e.target.value)} /></label>
                <div className="settingsToggleRow" style={{ borderBottom: form.estoqueIaWhatsapp ? 'none' : undefined }}>
                  <span style={{ color: 'var(--navy)', fontWeight: 800 }}>IA notifica via WhatsApp quando estoque abaixo do limite</span>
                  <label className="switch"><input type="checkbox" checked={form.estoqueIaWhatsapp} onChange={() => set('estoqueIaWhatsapp', !form.estoqueIaWhatsapp)} /><span></span></label>
                </div>
                {form.estoqueIaWhatsapp && (
                  <label style={{ borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Números a notificar</span>
                      <button type="button" style={{ border: 0, background: 'var(--orange)', color: '#fff', borderRadius: '999px', padding: '8px 12px', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }} onClick={() => set('estoqueWhatsappNumeros', [...(form.estoqueWhatsappNumeros || []), ''])}><Plus size={14} /> Adicionar</button>
                    </div>
                    {(form.estoqueWhatsappNumeros || []).length === 0 && (
                      <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '.82rem' }}>Nenhum número configurado.</span>
                    )}
                    {(form.estoqueWhatsappNumeros || []).map((num, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input style={{ flex: 1 }} type="tel" placeholder="(XX) XXXXX-XXXX" value={num} onChange={(e) => { const arr = [...form.estoqueWhatsappNumeros]; arr[i] = e.target.value; set('estoqueWhatsappNumeros', arr) }} />
                        <button type="button" onClick={() => set('estoqueWhatsappNumeros', form.estoqueWhatsappNumeros.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger, #e53935)', lineHeight: 1 }}><X size={16} /></button>
                      </div>
                    ))}
                  </label>
                )}
                <label>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Horários padrão de compra com fornecedores</span>
                    <button type="button" style={{ border: 0, background: 'var(--orange)', color: '#fff', borderRadius: '999px', padding: '8px 12px', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }} onClick={() => set('compraDatas', [...(form.compraDatas || []), ''])}><Plus size={14} /> Adicionar</button>
                  </div>
                  {(form.compraDatas || []).length === 0 && (
                    <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '.82rem' }}>Nenhum horário configurado.</span>
                  )}
                  {(form.compraDatas || []).map((dt, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}><DateTimePicker value={dt} onChange={(v) => { const arr = [...form.compraDatas]; arr[i] = v; set('compraDatas', arr) }} /></div>
                      <button type="button" onClick={() => set('compraDatas', form.compraDatas.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger, #e53935)', lineHeight: 1 }}><X size={16} /></button>
                    </div>
                  ))}
                </label>
                <label>Prompt de comportamento da IA com fornecedores
                  <textarea rows={6} value={form.iaFornecedorPrompt} onChange={(e) => set('iaFornecedorPrompt', e.target.value)} onFocus={(e) => { e.target.style.borderColor = 'var(--orange)'; e.target.style.background = '#fff' }} onBlur={(e) => { e.target.style.borderColor = 'var(--line)'; e.target.style.background = '#f9fbff' }} style={{ resize: 'vertical', width: '100%', padding: '11px 14px', borderRadius: 14, border: '1.5px solid var(--line)', font: 'inherit', color: 'var(--text)', fontWeight: 700, outline: 0, background: '#f9fbff', boxSizing: 'border-box' }} />
                </label>
                <label>Prompt de análise de documentos para importação de produtos
                  <textarea rows={8} value={form.iaImportPrompt} onChange={(e) => set('iaImportPrompt', e.target.value)} placeholder="Deixe em branco para usar o prompt padrão do sistema." onFocus={(e) => { e.target.style.borderColor = 'var(--orange)'; e.target.style.background = '#fff' }} onBlur={(e) => { e.target.style.borderColor = 'var(--line)'; e.target.style.background = '#f9fbff' }} style={{ resize: 'vertical', width: '100%', padding: '11px 14px', borderRadius: 14, border: '1.5px solid var(--line)', font: 'inherit', color: 'var(--text)', fontWeight: 700, outline: 0, background: '#f9fbff', boxSizing: 'border-box' }} />
                </label>
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
                    <CustomSelect
                      value={form.iaLigarDia}
                      onChange={(v) => set('iaLigarDia', v)}
                      options={[
                        { value: 'segunda', label: 'Segunda-feira' },
                        { value: 'terça',   label: 'Terça-feira'   },
                        { value: 'quarta',  label: 'Quarta-feira'  },
                        { value: 'quinta',  label: 'Quinta-feira'  },
                        { value: 'sexta',   label: 'Sexta-feira'   },
                        { value: 'sábado',  label: 'Sábado'        },
                      ]}
                    />
                  </label>
                  <label>Horário<TimePickerInput value={form.iaLigarHora} onChange={(v) => set('iaLigarHora', v)} /></label>
                </div>
              )}
              <div className="settingsInfo" style={{marginTop:'14px'}}>
                <Bot size={14} />
                <span>{form.iaLigarModo === 'ia'
                  ? 'A IA monitora o estoque em tempo real e aciona o contato assim que identificar risco de falta de produto.'
                  : `A IA ligará toda ${form.iaLigarDia}-feira às ${form.iaLigarHora} para verificar o estoque e alertar o contato configurado.`}
                </span>
              </div>
            </div>
          )}

          {activeSection === 'notificacoes' && (
            <div className="card settingsCard">
              <div className="cardHeader"><div><p>Alertas</p><h3>Notificações</h3></div><Bell size={22} /></div>
              <div className="settingsToggles">
                {[
                  ['notifOrders',         'Notificações de pedidos',      'Alertas ao receber ou atualizar um novo pedido'],
                  ['notifSellers',        'Notificações de vendedores',   'Alertas sobre atividades e ações dos vendedores'],
                  ['notifFiscalDocuments','Notificações de notas',        'Alertas sobre emissão e status de notas fiscais'],
                  ['notifStock',          'Notificações de estoque',      'Alertas quando produtos atingirem nível crítico de estoque'],
                  ['notifSuppliers',      'Notificações de fornecedores', 'Alertas sobre atualizações e cadastros de fornecedores'],
                  ['notifPurchases',      'Notificações de compras',      'Alertas sobre pedidos de compra e reposição de estoque'],
                  ['notifDeliveries',     'Notificações de entregas',     'Alertas sobre saída, rota e conclusão de entregas'],
                  ['notifClients',        'Notificações de clientes',     'Alertas sobre novos cadastros e atividades de clientes'],
                  ['notifPayments',       'Notificações de pagamentos',   'Alertas sobre registro e status de pagamentos'],
                ].map(([key, label, subtitle]) => (
                  <div className="settingsToggleRow" key={key}>
                    <div>
                      <span>{label}</span>
                      <small style={{display:'block', color:'var(--text-muted, #888)', fontSize:'12px', marginTop:'2px'}}>{subtitle}</small>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={form[key]} onChange={async () => {
                        const next = !form[key]
                        set(key, next)
                        onNotifSettingChange && onNotifSettingChange(key, next)
                        try {
                          await fetch(`${API_URL}/api/notification-settings`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ [key.toLowerCase()]: next }),
                          })
                        } catch {}
                      }} />
                      <span></span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'relatorios' && (
            <div className="card settingsCard">
              <div className="cardHeader"><div><p>Relatórios</p><h3>Envio por e-mail</h3></div><BarChart3 size={22} /></div>
              <div className="settingsForm">
                <label>E-mail de destino<input type="email" value={form.relatorioEmail} onChange={(e) => set('relatorioEmail', e.target.value)} /></label>
                <label>Frequência de envio
                  <CustomSelect
                    value={form.relatorioFreq}
                    onChange={(v) => set('relatorioFreq', v)}
                    options={[
                      { value: 'desativado', label: 'Desativado' },
                      { value: 'diario',     label: 'Diário'     },
                      { value: 'semanal',    label: 'Semanal'    },
                      { value: 'mensal',     label: 'Mensal'     },
                    ]}
                  />
                </label>
                {form.relatorioFreq !== 'desativado' && (
                  form.relatorioFreq === 'mensal' ? (
                    <div className="settingsTwoCols">
                      <label>Dia do envio
                        <CustomSelect
                          value={form.relatorioDia}
                          onChange={(v) => set('relatorioDia', v)}
                          placeholder="Selecione o dia"
                          options={Array.from({length: 28}, (_, i) => ({ value: String(i + 1), label: `Dia ${i + 1}` }))}
                        />
                      </label>
                      <label>Horário
                        <TimePickerInput value={form.relatorioHora} onChange={(v) => set('relatorioHora', v)} />
                      </label>
                    </div>
                  ) : (
                    <label>Horário
                      <TimePickerInput value={form.relatorioHora} onChange={(v) => set('relatorioHora', v)} />
                    </label>
                  )
                )}
              </div>
              <div className="settingsToggles" style={{marginTop:'12px'}}>
                <p className="settingsSub">Incluir no relatório:</p>
                {[['relatorioVendas','Resumo de vendas'],['relatorioEstoque','Movimentação de estoque'],['relatorioFinanceiro','Visão financeira'],['relatorioEntregas','Desempenho de entregas']].map(([key, label]) => (
                  <div className="settingsToggleRow" key={key}>
                    <span>{label}</span>
                    <label className="switch"><input type="checkbox" checked={form[key]} onChange={async () => {
                      const next = !form[key]
                      set(key, next)
                      try {
                        await fetch(`${API_URL}/api/report-settings`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ [key]: next }),
                        })
                      } catch {}
                    }} /><span></span></label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'fiscal' && <FiscalConfigSection notify={notify} />}
        </div>
      </div>
    </div>
    {showSaveBtn && (
      <div className="settingsSaveFooter">
        <button className="btnSolid" onClick={saveSettings} disabled={!operacaoDirty || !relatoriosDirty} style={{ opacity: (!operacaoDirty || !relatoriosDirty) ? 0.45 : 1, cursor: (!operacaoDirty || !relatoriosDirty) ? 'not-allowed' : 'pointer' }}><CheckCircle2 size={18} /> Salvar alterações</button>
      </div>
    )}
    </>
  )
}

function NewSellerModal({ onClose, onCreateSeller, editSeller, onUpdateSeller }) {
  const [form, setForm] = useState(() => editSeller ? {
    name: editSeller.name || '',
    email: '',
    whatsapp: editSeller.phone || '',
    password: '',
    city: editSeller.region || '',
    dailyGoal: editSeller.meta > 0 ? String(editSeller.meta) : '',
  } : { name: '', email: '', whatsapp: '', password: '', city: '', dailyGoal: '' })
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const canSubmit = editSeller
    ? form.name.trim() !== '' && form.city.trim() !== ''
    : form.name.trim() !== '' && form.email.trim() !== '' && form.password.length >= 6 && form.city.trim() !== ''

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitError('')
    setSubmitting(true)
    try {
      if (editSeller) {
        const payload = {
          sellerId: editSeller.id,
          name: form.name.trim(),
          whatsapp: form.whatsapp || null,
          city: form.city.trim(),
          dailyGoal: form.dailyGoal !== '' ? Number(form.dailyGoal) : 0,
        }
        const res = await fetch(`${API_URL}/api/sellers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar vendedor')
        onUpdateSeller({
          ...editSeller,
          name: form.name.trim(),
          phone: form.whatsapp || editSeller.phone,
          region: form.city.trim(),
          meta: form.dailyGoal !== '' ? Number(form.dailyGoal) : 0,
          avatar: form.name.trim()[0].toUpperCase(),
        })
        onClose()
      } else {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          whatsapp: form.whatsapp || null,
          password: form.password,
          city: form.city.trim(),
          dailyGoal: form.dailyGoal !== '' ? Number(form.dailyGoal) : 0,
        }
        const res = await fetch(`${API_URL}/api/sellers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar vendedor')
        onCreateSeller(data.seller)
        onClose()
      }
    } catch (err) {
      setSubmitError(err.message || `Erro ao ${editSeller ? 'atualizar' : 'cadastrar'} vendedor. Tente novamente.`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modalBackdrop">
      <div className="detailModal newOrderModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>{editSeller ? 'Edição' : 'Cadastro'}</span>
            <h2>{editSeller ? 'Editar vendedor' : 'Novo vendedor'}</h2>
            <p>{editSeller ? 'Altere os dados do vendedor e salve as modificações' : 'Preencha os dados do vendedor para cadastrá-lo no sistema'}</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <div className="newOrderScrollArea">
            <h3>Dados do vendedor</h3>
            <div className="settingsForm">
              <label>Nome completo *
                <input placeholder="Ex: João da Silva" value={form.name} onChange={(e) => set('name', e.target.value)} required />
              </label>
              {!editSeller && (
                <label>E-mail *
                  <input type="email" placeholder="vendedor@saborsan.com" value={form.email} onChange={(e) => set('email', e.target.value)} required />
                </label>
              )}
              <label>WhatsApp
                <input placeholder="(49) 99999-0000" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
              </label>
              {!editSeller && (
                <label>Senha de acesso *
                  <input type="password" placeholder="Mín. 6 caracteres" value={form.password} onChange={(e) => set('password', e.target.value)} required />
                </label>
              )}
              <label>Cidade / Região *
                <input placeholder="Lages - SC" value={form.city} onChange={(e) => set('city', e.target.value)} required />
              </label>
              <label>Meta diária (R$)
                <input type="number" min="0" step="0.01" placeholder="0,00" value={form.dailyGoal} onChange={(e) => set('dailyGoal', e.target.value)} />
              </label>
            </div>
          </div>
          <div className="newOrderFooter">
            {submitError && <small className="errorText">{submitError}</small>}
            <div className="newOrderFooterActions" style={{ marginLeft: 'auto' }}>
              <button type="submit" className="btnPrimary" disabled={!canSubmit || submitting}>
                <CheckCircle2 size={17} /> {submitting ? (editSeller ? 'Salvando...' : 'Cadastrando...') : (editSeller ? 'Salvar alterações' : 'Cadastrar vendedor')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function SellerDetailModal({ seller, onClose, onToggleActive, onEdit }) {
  const pct = seller.meta > 0 ? Math.min(100, Math.round((seller.total / seller.meta) * 100)) : 0
  return (
    <div className="modalBackdrop">
      <div className="detailModal orderModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>Vendedor #{seller.id}</span>
            <h2>{seller.name}</h2>
            <p>{seller.region} • {seller.phone}</p>
          </div>
          <Status status={seller.status} />
        </div>
        <div className="orderModalBody">
          <div className="modalSplit">
            <div>
              <h3>Desempenho de vendas</h3>
              <div className="detailGrid">
                <div><b>Total vendido</b><span>{money(seller.total)}</span></div>
                <div><b>Meta do período</b><span>{money(seller.meta)}</span></div>
                <div><b>Atingimento</b><span>{pct}%</span></div>
                <div><b>Nº de vendas</b><span>{seller.sales.length}</span></div>
              </div>
              <div className="stockLevel" style={{ marginTop: 12 }}><div style={{ width: `${pct}%` }}></div></div>
              <small style={{ color: 'var(--muted)', fontSize: 12 }}>{money(seller.total)} de {money(seller.meta)} ({pct}%)</small>
            </div>
            <div className="summaryBox">
              <h3>Dados do vendedor</h3>
              <p><b>Nome:</b> {seller.name}</p>
              <p><b>Região:</b> {seller.region}</p>
              <p><b>WhatsApp:</b> {seller.phone}</p>
              <p><b>Status:</b> {seller.status}</p>
            </div>
          </div>
          <h3 style={{ marginTop: 20 }}>Vendas realizadas</h3>
          <div className="modalItems">
            {seller.sales.map((sale) => (
              <div key={sale.id}>
                <span>{sale.date}</span>
                <b>{sale.customer} <small style={{ fontWeight: 400, color: 'var(--muted)' }}>({sale.city})</small></b>
                <strong>{money(sale.value)}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="orderModalFooter">
          <button className="orderModalBtn orderModalBtnDanger" onClick={() => onToggleActive(seller)}>{seller.status === 'Ativo' ? 'Tornar inativo' : 'Tornar ativo'}</button>
          <button className="orderModalBtn orderModalBtnPrimary" onClick={onEdit}>Editar</button>
        </div>
      </div>
    </div>
  )
}

function Sellers({ search = '', addNotif }) {
  const [sellersData, setSellersData] = useState([])
  const [sellersLoading, setSellersLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [sellerDetailOpen, setSellerDetailOpen] = useState(false)
  const [newSellerOpen, setNewSellerOpen] = useState(false)
  const [editSeller, setEditSeller] = useState(null)
  const seller = selected ? sellersData.find((s) => s.id === selected) : null
  const totalGeral = sellersData.reduce((a, s) => a + s.total, 0)
  const bestSeller = sellersData.length > 0 ? sellersData.reduce((a, b) => a.total > b.total ? a : b) : null
  const notifiedSellersRef = useRef(new Set())

  useEffect(() => {
    setSellersLoading(true)
    fetch(`${API_URL}/api/sellers`)
      .then((r) => r.json())
      .then((data) => {
        if (data.sellers) {
          setSellersData(data.sellers)
          if (addNotif) {
            data.sellers.forEach((s) => {
              if (s.meta > 0 && s.total >= s.meta && !notifiedSellersRef.current.has(`meta_${s.id}`)) {
                const sessionKey = `notif_seller_meta_${s.id}`
                if (!sessionStorage.getItem(sessionKey)) {
                  addNotif('notifSellers', { icon: TrendingUp, title: 'Meta de vendas atingida', text: `${s.name} atingiu a meta de ${money(s.meta)} em vendas!` })
                  sessionStorage.setItem(sessionKey, '1')
                  notifiedSellersRef.current.add(`meta_${s.id}`)
                }
              }
            })
          }
        }
      })
      .catch(() => {})
      .finally(() => setSellersLoading(false))
  }, [])

  const addSeller = (newSeller) => {
    setSellersData((prev) => [...prev, newSeller])
  }

  const updateSeller = (updatedSeller) => {
    setSellersData((prev) => prev.map((s) => s.id === updatedSeller.id ? updatedSeller : s))
  }

  const toggleSellerStatus = async (seller) => {
    const newIsActive = seller.status !== 'Ativo'
    try {
      await fetch(`${API_URL}/api/sellers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: seller.id, isActive: newIsActive }),
      })
      setSellersData((prev) => prev.map((s) => s.id === seller.id ? { ...s, status: newIsActive ? 'Ativo' : 'Inativo' } : s))
      setSellerDetailOpen(false)
    } catch (e) {}
  }

  return (
    <section className="pageStack">
      <div className="sectionHeader"><div><p>Vendas realizadas pelo app</p></div><button className="btnSolid" onClick={() => setNewSellerOpen(true)}><UserRound size={18} /> Novo vendedor</button></div>

      <div className="sellersSummary">
        <div className="card sellerStat"><span>Total de vendas</span><strong>{money(totalGeral)}</strong><small>{sellersData.reduce((a, s) => a + s.sales.length, 0)} pedidos no período</small></div>
        <div className="card sellerStat"><span>Vendedores ativos</span><strong>{sellersData.filter(s => s.status === 'Ativo').length}</strong><small>de {sellersData.length} cadastrados</small></div>
        <div className="card sellerStat"><span>Melhor vendedor</span><strong>{bestSeller ? bestSeller.name.split(' ')[0] : '—'}</strong><small>{bestSeller ? money(bestSeller.total) : '—'}</small></div>
      </div>

      {sellersLoading && <p className="loadingText">Carregando vendedores...</p>}
      {!sellersLoading && sellersData.length === 0 && <p className="emptyText">Nenhum vendedor cadastrado.</p>}

      <div className="sellersGrid">
        {(!search ? sellersData : sellersData.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))).map((s) => {
          const pct = s.meta > 0 ? Math.min(100, Math.round((s.total / s.meta) * 100)) : 0
          return (
            <article className={`sellerCard${selected === s.id ? ' sellerActive' : ''}`} key={s.id} onClick={() => setSelected(selected === s.id ? null : s.id)}>
              <div className="sellerTop">
                <div className="avatar">{s.avatar}</div>
                <div><h3>{s.name}</h3><p>{s.region}</p></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                  <button style={{ border: 0, background: '#f2f6fb', color: 'var(--navy)', borderRadius: 999, padding: '9px 12px', fontWeight: 900, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSelected(s.id); setSellerDetailOpen(true) }}>Detalhes</button>
                  <Status status={s.status} />
                </div>
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

      {sellerDetailOpen && seller && <SellerDetailModal seller={seller} onClose={() => setSellerDetailOpen(false)} onToggleActive={toggleSellerStatus} onEdit={() => { setSellerDetailOpen(false); setEditSeller(seller) }} />}
      {(newSellerOpen || editSeller) && <NewSellerModal onClose={() => { setNewSellerOpen(false); setEditSeller(null) }} onCreateSeller={addSeller} editSeller={editSeller} onUpdateSeller={updateSeller} />}
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

function NotaFiscalModal({ order, onClose, updateOrderStatus, notify, addNotif }) {
  const [step, setStep] = useState('previa')
  const [purchasePurpose, setPurchasePurpose] = useState(order.purchasePurpose || 'consumo')
  // 0=preparando 1=enviando para Focus 2=recebido pela Focus 3=aguardando SEFAZ
  const [enviandoPhase, setEnviandoPhase] = useState(0)
  const [nfeResult, setNfeResult] = useState(null)   // { status, reference, number, series, accessKey, protocol }
  const [nfeError, setNfeError] = useState(null)     // { errorMessage, errorCode, reference? }
  const [submitting, setSubmitting] = useState(false)
  const pollingRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pollingRef.current) clearTimeout(pollingRef.current)
    }
  }, [])

  const productTotal = order.products.reduce((sum, p) => sum + p.qty * p.price, 0)

  // Stepper helpers: when rejected, light up steps up to 'enviando'
  const stepIndex = step === 'rejeitada' ? STEPS.indexOf('enviando') : STEPS.indexOf(step)
  const isActiveStep = (id) => step === id || (step === 'rejeitada' && id === 'enviando')

  // ── Validation items for the 'validacao' step ───────────────────────────
  const allPricesOk = order.products.every((p) => p.qty > 0 && p.price >= 0)
  const allNcmMapped = order.products.every((p) => !!ncmMap[p.name])
  const hasCnpj = !!(order.cnpj && order.cnpj !== '-')
  const hasCity = !!(order.city && order.city !== '-')
  const validationItems = [
    { label: `Cliente: ${order.customer}`, ok: !!order.customer, required: true },
    { label: `CNPJ: ${hasCnpj ? order.cnpj : 'Não informado'}`, ok: hasCnpj, required: true },
    { label: `Cidade/UF: ${hasCity ? order.city : 'Não informada'}`, ok: hasCity, required: true },
    { label: `${order.products.length} produto(s) no pedido`, ok: order.products.length > 0, required: true },
    { label: 'Quantidades e preços válidos', ok: allPricesOk, required: true },
    { label: `Finalidade: ${purchasePurpose === 'consumo' ? 'Consumo próprio' : 'Revenda / industrialização'}`, ok: true, required: false },
    { label: 'NCM disponível para todos os produtos', ok: allNcmMapped, required: false },
  ]
  const canSubmit = validationItems.filter((v) => !v.ok && v.required).length === 0

  // ── Polling ─────────────────────────────────────────────────────────────
  const startPolling = (ref, attempt = 0) => {
    if (!mountedRef.current) return
    if (attempt >= 40) {
      if (mountedRef.current) {
        setNfeError({ errorMessage: 'Tempo de espera excedido. Consulte o painel da Focus NFe para verificar o status.' })
        setStep('rejeitada')
      }
      return
    }
    setEnviandoPhase(3)
    pollingRef.current = setTimeout(async () => {
      if (!mountedRef.current) return
      try {
        const res = await fetch(`${API_URL}/api/emit-nfe?ref=${encodeURIComponent(ref)}`)
        const data = await res.json()
        if (!mountedRef.current) return
        if (data.status === 'AUTHORIZED') {
          setNfeResult(data)
          setStep('autorizada')
          updateOrderStatus(order.id, 'Pronto', { nfeData: { ...data, reference: ref, nfeStatus: 'AUTHORIZED' } })
          notify(`NF-e ${data.number ? `nº ${data.number} ` : ''}autorizada para ${order.customer}.`)
          addNotif && addNotif('notifFiscalDocuments', { icon: ReceiptText, title: 'Nota fiscal autorizada', text: `NF-e de ${order.customer} foi autorizada pelo SEFAZ.` })
        } else if (data.status === 'REJECTED' || data.status === 'SUBMISSION_FAILED') {
          setNfeError(data)
          setStep('rejeitada')
          updateOrderStatus(order.id, 'Pronto', { nfeData: { nfeStatus: data.status, errorCode: data.errorCode || null, errorMessage: data.errorMessage || null, reference: ref } })
          addNotif && addNotif('notifFiscalDocuments', { icon: AlertTriangle, type: 'warning', title: 'Nota fiscal negada', text: `NF-e de ${order.customer} foi negada ou gerou erro pelo SEFAZ / Focus NF-e.` })
        } else {
          startPolling(ref, attempt + 1)
        }
      } catch {
        if (mountedRef.current) startPolling(ref, attempt + 1)
      }
    }, 3000)
  }

  // ── Emission ─────────────────────────────────────────────────────────────
  const startEnvio = async () => {
    setStep('enviando')
    setEnviandoPhase(0)
    setSubmitting(true)
    try {
      setEnviandoPhase(1)
      const res = await fetch(`${API_URL}/api/emit-nfe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, purchasePurpose }),
      })
      const data = await res.json()
      if (!mountedRef.current) return

      if (data.configError) {
        setNfeError({ errorMessage: data.error })
        setStep('rejeitada')
        return
      }
      if (data.status === 'AUTHORIZED') {
        setNfeResult(data)
        setStep('autorizada')
        updateOrderStatus(order.id, 'Pronto', { nfeData: { ...data, nfeStatus: 'AUTHORIZED' } })
        notify(`NF-e ${data.number ? `nº ${data.number} ` : ''}autorizada para ${order.customer}.`)
        addNotif && addNotif('notifFiscalDocuments', { icon: ReceiptText, title: 'Nota fiscal autorizada', text: `NF-e de ${order.customer} foi autorizada pelo SEFAZ.` })
        return
      }
      if ((data.status === 'PROCESSING' || data.status === 'SUBMITTING') && data.reference) {
        setEnviandoPhase(2)
        startPolling(data.reference)
        return
      }
      if (data.status === 'REJECTED' || data.status === 'SUBMISSION_FAILED') {
        setNfeError(data)
        setStep('rejeitada')
        updateOrderStatus(order.id, 'Pronto', { nfeData: { nfeStatus: data.status, errorCode: data.errorCode || null, errorMessage: data.errorMessage || null, reference: data.reference || null } })
        addNotif && addNotif('notifFiscalDocuments', { icon: AlertTriangle, type: 'warning', title: 'Nota fiscal negada', text: `NF-e de ${order.customer} foi negada ou gerou erro pelo SEFAZ / Focus NF-e.` })
        return
      }
      if (data.status === 'FISCAL_RULES_ERROR' || data.status === 'VALIDATION_ERROR') {
        setNfeError({ errorMessage: data.errorMessage || data.error || 'Erro de validação fiscal.' })
        setStep('rejeitada')
        return
      }
      setNfeError({ errorMessage: data.error || 'Resposta inesperada do servidor.' })
      setStep('rejeitada')
    } catch (err) {
      if (mountedRef.current) {
        setNfeError({ errorMessage: 'Não foi possível conectar ao servidor. Verifique sua conexão.' })
        setStep('rejeitada')
      }
    } finally {
      if (mountedRef.current) setSubmitting(false)
    }
  }

  const downloadFile = async (type) => {
    if (!nfeResult?.reference) return
    try {
      const res = await fetch(`${API_URL}/api/emit-nfe?ref=${encodeURIComponent(nfeResult.reference)}&download=${type}`)
      if (!res.ok) throw new Error('Falha ao baixar arquivo')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = type === 'xml' ? `NFe_${nfeResult.reference}.xml` : `DANFE_${nfeResult.reference}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      notify('Não foi possível baixar o arquivo. Tente novamente.')
    }
  }

  const handleRetry = () => {
    setNfeError(null)
    setStep('previa')
  }

  const finalizar = () => { onClose() }

  return (
    <div className="nfOverlay" onClick={(e) => { if (e.target.classList.contains('nfOverlay') && step !== 'enviando') onClose() }}>
      <div className="nfModal">

        {/* Stepper */}
        <div className="nfStepper">
          {[['Prévia', 'previa'], ['Validação', 'validacao'], ['Enviando', 'enviando'], ['Autorizada', 'autorizada'], ['Enviar cliente', 'cliente']].map(([label, id], i) => (
            <div key={id} className={`nfStep${STEPS.indexOf(id) <= stepIndex ? ' done' : ''}${isActiveStep(id) ? ' active' : ''}`}>
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
            {order.nfeData && order.nfeData.nfeStatus !== 'AUTHORIZED' && (
              <div className="verNotaErrorBox" style={{ marginBottom: 16 }}>
                <div className="verNotaErrorTitle"><AlertTriangle size={17} /> Tentativa anterior com erro</div>
                {order.nfeData.errorCode && <span className="verNotaErrorCode">Código: {order.nfeData.errorCode}</span>}
                <p className="verNotaErrorMsg">{order.nfeData.errorMessage || 'Ocorreu um erro ao emitir esta nota fiscal.'}</p>
              </div>
            )}
            <div className="nfGrid">
              <div className="nfCard">
                <p className="nfLabel">Emitente</p>
                <b>Saborsan Distribuidora LTDA</b>
                <small>CNPJ: 05.533.744/0001-95</small>
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
            <div className="nfFinalidade">
              <p className="nfLabel">Finalidade da compra</p>
              <div className="nfFinalidadeOpts">
                <label className={`nfFinalidadeOpt${purchasePurpose === 'consumo' ? ' selected' : ''}`}>
                  <input type="radio" name="finalidade" value="consumo" checked={purchasePurpose === 'consumo'} onChange={() => setPurchasePurpose('consumo')} />
                  <span>Consumo próprio</span>
                  <small>Uso interno, sem revenda</small>
                </label>
                <label className={`nfFinalidadeOpt${purchasePurpose === 'revenda' ? ' selected' : ''}`}>
                  <input type="radio" name="finalidade" value="revenda" checked={purchasePurpose === 'revenda'} onChange={() => setPurchasePurpose('revenda')} />
                  <span>Revenda / Industrialização</span>
                  <small>Requer Inscrição Estadual</small>
                </label>
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
              <div className="nfTableFoot total">
                <span>Total dos produtos</span><span>{money(productTotal)}</span>
              </div>
            </div>
            <div className="nfAI">
              <div className="nfAIHeader"><Sparkles size={16} /><b>Emissão via Focus NFe</b></div>
              <div className="nfAIItem success"><CheckCircle2 size={14} /> NF-e modelo 55 — transmissão direta à SEFAZ</div>
              <div className="nfAIItem success"><CheckCircle2 size={14} /> Certificado digital gerenciado pela Focus NFe</div>
              <div className="nfAIItem warning"><AlertTriangle size={14} /> Dados fiscais (NCM, CFOP, CST, alíquotas) devem ser validados pelo contador</div>
              <div className="nfAIItem warning"><AlertTriangle size={14} /> Verifique substituição tributária nos produtos congelados (ICMS-ST)</div>
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
              {validationItems.map((item) => (
                <div className={`nfCheckItem${!item.ok ? item.required ? ' error' : ' warn' : ''}`} key={item.label}>
                  {item.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span>{item.label}</span>
                </div>
              ))}
              <div className="nfCheckItem warn">
                <AlertTriangle size={16} />
                <span>Configuração fiscal (alíquotas, CEST, ICMS-ST) deve ser validada pelo contador</span>
              </div>
              <div className="nfCheckItem">
                <CheckCircle2 size={16} />
                <span>Certificado digital gerenciado pela Focus NFe</span>
              </div>
            </div>
            {canSubmit
              ? <div className="nfStatusBadge"><ShieldCheck size={18} /> Dados validados — pronto para envio à SEFAZ</div>
              : <div className="nfStatusBadge error"><AlertTriangle size={18} /> Corrija os campos obrigatórios antes de enviar</div>
            }
          </div>
        )}

        {/* STEP 3 - Enviando */}
        {step === 'enviando' && (
          <div className="nfBody nfCentered">
            <div className="nfSending">
              <div className="nfSpinner" />
              <h2>Processando NF-e via Focus NFe...</h2>
              <div className="nfSendingSteps">
                {[
                  'Preparando dados fiscais...',
                  'Enviando para Focus NFe...',
                  'Nota recebida pela Focus — aguardando SEFAZ...',
                  'Aguardando autorização da SEFAZ...',
                ].map((label, i) => (
                  <div key={i} className={`nfSendStep${enviandoPhase > i ? ' done' : ''}${enviandoPhase === i ? ' current' : ''}`}>
                    {enviandoPhase > i ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="nfSendingNote">Não feche esta janela. O processo pode levar alguns segundos.</p>
            </div>
          </div>
        )}

        {/* STEP REJEITADA */}
        {step === 'rejeitada' && (
          <div className="nfBody nfCentered">
            <div className="nfRejected">
              <div className="nfRejectedIcon"><AlertTriangle size={44} /></div>
              <h2>Emissão não concluída</h2>
              <p>A NF-e não foi autorizada. Verifique os detalhes abaixo.</p>
              {nfeError?.errorCode && (
                <div className="nfErrorCode"><small>Código</small><b>{nfeError.errorCode}</b></div>
              )}
              <div className="nfErrorMsg">{nfeError?.errorMessage || 'Erro desconhecido. Consulte o painel da Focus NFe.'}</div>
              {nfeError?.reference && (
                <div className="nfErrorRef"><small>Referência: <code>{nfeError.reference}</code></small></div>
              )}
              <div className="nfRejectedNote">
                <AlertTriangle size={14} />
                <span>Não altere dados fiscais (NCM, CFOP, CST, alíquotas) sem consultar o contador.</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4 - Autorizada */}
        {step === 'autorizada' && (
          <div className="nfBody nfCentered">
            <div className="nfSuccess">
              <div className="nfSuccessIcon"><CheckCircle2 size={44} /></div>
              <h2>NF-e autorizada pela SEFAZ!</h2>
              <p>A nota fiscal foi transmitida, processada e autorizada com sucesso.</p>
              <div className="nfAutorizadaGrid">
                {nfeResult?.number && <div><small>Número da nota</small><b>{nfeResult.number}</b></div>}
                {nfeResult?.series && <div><small>Série</small><b>{nfeResult.series}</b></div>}
                {nfeResult?.protocol && <div><small>Protocolo SEFAZ</small><b>{nfeResult.protocol}</b></div>}
                {nfeResult?.accessKey && (
                  <div className="span2"><small>Chave de acesso</small><b className="mono">{nfeResult.accessKey}</b></div>
                )}
              </div>
              <div className="nfDocButtons">
                <button className="nfDocBtn" onClick={() => downloadFile('xml')}><FileText size={15} /> Baixar XML</button>
                <button className="nfDocBtn" onClick={() => downloadFile('danfe')}><ReceiptText size={15} /> Baixar DANFE</button>
              </div>
              <div className="nfStatusBadge success">NF-e autorizada – pedido permanece em Pronto</div>
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
              <div className="nfCard"><p className="nfLabel">E-mail</p><b>financeiro@{order.customer.toLowerCase().replace(/[^a-z0-9]/gi, '')}.com.br</b></div>
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
          </div>
        )}

        {/* Fixed footer buttons - all steps except 'enviando' */}
        {step !== 'enviando' && (
          <div className="nfFooter">
            <div className="nfFooterActions">
              {step === 'previa' && (
                <>
                  <button className="nfFooterPrimary" onClick={() => setStep('validacao')}>Validar nota</button>
                  <button className="nfFooterBtn" onClick={onClose}>Cancelar</button>
                </>
              )}
              {step === 'validacao' && (
                <>
                  <button className="nfFooterPrimary" onClick={startEnvio} disabled={!canSubmit || submitting}>
                    {submitting ? 'Aguarde...' : 'Enviar para SEFAZ'}
                  </button>
                  <button className="nfFooterBtn" onClick={() => setStep('previa')}>Voltar</button>
                </>
              )}
              {step === 'rejeitada' && (
                <>
                  <button className="nfFooterPrimary" onClick={handleRetry}>Tentar novamente</button>
                  <button className="nfFooterBtn" onClick={finalizar}>Fechar</button>
                </>
              )}
              {step === 'autorizada' && (
                <>
                  <button className="nfFooterPrimary" onClick={() => setStep('cliente')}>Enviar para cliente</button>
                  <button className="nfFooterBtn" onClick={finalizar}>Fechar</button>
                </>
              )}
              {step === 'cliente' && (
                <>
                  <button className="nfFooterPrimary" onClick={finalizar}>Enviar agora</button>
                  <button className="nfFooterBtn" onClick={() => setStep('autorizada')}>Voltar</button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function VerNotaModal({ order, onClose, onSendToClient, onGerarNota, updateOrderStatus }) {
  const nfe = order.nfeData
  const hasSent = !!order.nfeSentAt

  const [showDetails, setShowDetails] = useState(false)
  const [nfeDetails, setNfeDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState(null)

  const downloadFile = async (type) => {
    if (!nfe?.reference) return
    try {
      const res = await fetch(`${API_URL}/api/emit-nfe?ref=${encodeURIComponent(nfe.reference)}&download=${type}`)
      if (!res.ok) throw new Error('Falha ao baixar arquivo')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = type === 'xml' ? `NFe_${nfe.reference}.xml` : `DANFE_${nfe.reference}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // silently fail — button remains clickable for retry
    }
  }

  const openNfeDetails = async () => {
    if (!nfe?.reference) return
    setShowDetails(true)
    if (nfeDetails) return // already loaded
    setDetailsLoading(true)
    setDetailsError(null)
    try {
      const res = await fetch(`${API_URL}/api/emit-nfe?ref=${encodeURIComponent(nfe.reference)}&details=1`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar detalhes')
      setNfeDetails(data)
      // Corrige estado em memória se SEFAZ rejeitou mas a nota ainda consta como Emitida
      // Corrige estado e status do pedido se SEFAZ rejeitou mas a nota constava como Emitida
      if (data.statusSefaz && data.statusSefaz !== '100' && nfe.nfeStatus === 'AUTHORIZED' && updateOrderStatus) {
        updateOrderStatus(order.id, 'Pronto', {
          nfeData: {
            ...nfe,
            nfeStatus: 'REJECTED',
            errorCode: data.statusSefaz,
            errorMessage: data.messageSefaz || 'Nota rejeitada pelo SEFAZ',
          },
        })
      }
    } catch (err) {
      setDetailsError(err.message || 'Falha ao carregar detalhes da nota')
    } finally {
      setDetailsLoading(false)
    }
  }

  const sentLabel = order.nfeSentAt
    ? `Enviado em ${new Date(order.nfeSentAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${new Date(order.nfeSentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : 'Ainda não enviado'

  const fmtDate = (iso) => {
    if (!iso) return null
    try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
    catch { return iso }
  }

  return (
    <div className="modalBackdrop">
      <div className="detailModal verNotaModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>{order.id}</span>
            <h2>Nota Fiscal Eletrônica</h2>
            <p>{order.customer} • {order.city}</p>
          </div>
          <div className="verNotaHeaderBadges">
            <Status status={
              (nfeDetails && nfeDetails.statusSefaz && nfeDetails.statusSefaz !== '100')
                ? 'Erro na nota'
                : nfe?.nfeStatus === 'AUTHORIZED' ? 'Nota emitida' : 'Erro na nota'
            } />
            {nfe?.number && <small className="verNotaNum">NF-e nº {nfe.number}</small>}
          </div>
        </div>

        {showDetails ? (
          <div className="verNotaDetailsWrapper">
            <button className="verNotaDetailsBack" onClick={() => setShowDetails(false)}>
              <ArrowLeft size={15} /> Voltar
            </button>

            {detailsLoading && (
              <div className="verNotaDetailsLoading">
                <Loader2 size={28} className="verNotaDetailsSpinner" />
                <span>Consultando Focus NFe...</span>
              </div>
            )}

            {detailsError && (
              <div className="verNotaDetailsError">
                <AlertTriangle size={18} />
                <span>{detailsError}</span>
              </div>
            )}

            {nfeDetails && !detailsLoading && (
              <>
                {nfeDetails.messageSefaz && (() => {
                  const isErr = nfeDetails.statusSefaz && nfeDetails.statusSefaz !== '100'
                  return (
                    <div className={`verNotaDetailsBanner${isErr ? ' error' : ''}`}>
                      {isErr ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                      <span>{nfeDetails.messageSefaz}{nfeDetails.statusSefaz ? ` (${nfeDetails.statusSefaz})` : ''}</span>
                    </div>
                  )
                })()}

                <div className="verNotaGrid" style={{ marginTop: 12 }}>
                  {nfeDetails.number && <div className="verNotaInfo"><small>Número NF-e</small><b>{nfeDetails.number}</b></div>}
                  {nfeDetails.series && <div className="verNotaInfo"><small>Série</small><b>{nfeDetails.series}</b></div>}
                  {nfeDetails.protocol && <div className="verNotaInfo"><small>Protocolo SEFAZ</small><b>{nfeDetails.protocol}</b></div>}
                  {nfeDetails.issuedAt && <div className="verNotaInfo"><small>Emissão</small><b>{fmtDate(nfeDetails.issuedAt)}</b></div>}
                  {nfeDetails.natureza && <div className="verNotaInfo verNotaSpan"><small>Natureza da operação</small><b>{nfeDetails.natureza}</b></div>}
                  {nfeDetails.accessKey && <div className="verNotaInfo verNotaSpan"><small>Chave de acesso</small><b className="mono">{nfeDetails.accessKey}</b></div>}
                </div>

                {nfeDetails.recipient?.name && (
                  <div className="verNotaDetailsSection">
                    <div className="verNotaDetailsSectionTitle"><Users size={13} /> Destinatário</div>
                    <div className="verNotaGrid" style={{ marginTop: 8 }}>
                      <div className="verNotaInfo verNotaSpan"><small>Razão Social</small><b>{nfeDetails.recipient.name}</b></div>
                      {nfeDetails.recipient.cnpj && <div className="verNotaInfo"><small>CNPJ</small><b>{nfeDetails.recipient.cnpj}</b></div>}
                      {(nfeDetails.recipient.city || nfeDetails.recipient.state) && (
                        <div className="verNotaInfo"><small>Município/UF</small><b>{[nfeDetails.recipient.city, nfeDetails.recipient.state].filter(Boolean).join(' - ')}</b></div>
                      )}
                    </div>
                  </div>
                )}

                {nfeDetails.items?.length > 0 && (
                  <div className="verNotaDetailsSection">
                    <div className="verNotaDetailsSectionTitle"><Package size={13} /> Produtos ({nfeDetails.items.length})</div>
                    <div className="verNotaDetailsTable">
                      <div className="verNotaDetailsTableHead">
                        <span>Descrição</span>
                        <span>NCM</span>
                        <span>CFOP</span>
                        <span>Qtd</span>
                        <span>Total</span>
                      </div>
                      {nfeDetails.items.map((item, i) => (
                        <div className="verNotaDetailsTableRow" key={i}>
                          <span>{item.description}</span>
                          <span>{item.ncm}</span>
                          <span>{item.cfop}</span>
                          <span>{item.quantity} {item.unit}</span>
                          <span>{money(item.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {nfeDetails.totals && (
                  <div className="verNotaDetailsSection">
                    <div className="verNotaDetailsSectionTitle"><Info size={13} /> Totais</div>
                    <div className="verNotaDetailsTotals">
                      {nfeDetails.totals.products > 0 && <div><span>Valor dos produtos</span><b>{money(nfeDetails.totals.products)}</b></div>}
                      {nfeDetails.totals.icms > 0 && <div><span>ICMS</span><b>{money(nfeDetails.totals.icms)}</b></div>}
                      {nfeDetails.totals.pis > 0 && <div><span>PIS</span><b>{money(nfeDetails.totals.pis)}</b></div>}
                      {nfeDetails.totals.cofins > 0 && <div><span>COFINS</span><b>{money(nfeDetails.totals.cofins)}</b></div>}
                      {nfeDetails.totals.freight > 0 && <div><span>Frete</span><b>{money(nfeDetails.totals.freight)}</b></div>}
                      {nfeDetails.totals.discount > 0 && <div><span>Desconto</span><b>-{money(nfeDetails.totals.discount)}</b></div>}
                      {nfeDetails.totals.total > 0 && <div className="verNotaDetailsTotalFinal"><span>Valor total NF-e</span><b>{money(nfeDetails.totals.total)}</b></div>}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : nfe ? (
          <>
            {nfe.nfeStatus !== 'AUTHORIZED' && (
              <div className="verNotaErrorBox">
                <div className="verNotaErrorTitle"><AlertTriangle size={17} /> Erro na emissão da nota fiscal</div>
                {nfe.errorCode && <span className="verNotaErrorCode">Código: {nfe.errorCode}</span>}
                <p className="verNotaErrorMsg">{nfe.errorMessage || 'Ocorreu um erro ao emitir esta nota fiscal. Verifique os dados e tente gerar uma nova nota.'}</p>
              </div>
            )}
            {nfe.nfeStatus !== 'AUTHORIZED' && onGerarNota && (
              <button className="verNotaGerarBtn" onClick={() => onGerarNota(order)}>
                <ReceiptText size={17} /> Gerar nova nota
              </button>
            )}
            {nfe.nfeStatus === 'AUTHORIZED' && (
            <div className="verNotaGrid">
              {nfe.number && <div className="verNotaInfo"><small>Número</small><b>{nfe.number}</b></div>}
              {nfe.series && <div className="verNotaInfo"><small>Série</small><b>{nfe.series}</b></div>}
              {nfe.protocol && <div className="verNotaInfo"><small>Protocolo SEFAZ</small><b>{nfe.protocol}</b></div>}
              {nfe.accessKey && <div className="verNotaInfo verNotaSpan"><small>Chave de acesso</small><b className="mono">{nfe.accessKey}</b></div>}
            </div>
            )}

            {nfe.nfeStatus === 'AUTHORIZED' && <div className="verNotaActions">
              <button className="verNotaActionBtn" onClick={openNfeDetails} disabled={!nfe.reference}>
                <div className="verNotaActionIcon"><FileText size={20} /></div>
                <div className="verNotaActionText"><b>Ver NF-e</b><span>Detalhes completos via Focus NFe</span></div>
                <ChevronRight size={15} />
              </button>

              <button className="verNotaActionBtn" onClick={() => downloadFile('xml')} disabled={!nfe.reference}>
                <div className="verNotaActionIcon"><FileDown size={20} /></div>
                <div className="verNotaActionText"><b>Baixar XML</b><span>Arquivo XML da nota fiscal</span></div>
                <ChevronRight size={15} />
              </button>

              <button className="verNotaActionBtn" onClick={() => downloadFile('danfe')} disabled={!nfe.reference}>
                <div className="verNotaActionIcon"><ReceiptText size={20} /></div>
                <div className="verNotaActionText"><b>Baixar DANFE</b><span>Documento auxiliar em PDF</span></div>
                <ChevronRight size={15} />
              </button>

              <button className={`verNotaActionBtn${hasSent ? ' verNotaSent' : ''}`} onClick={() => !hasSent && onSendToClient(order.id)}>
                <div className="verNotaActionIcon"><Send size={20} /></div>
                <div className="verNotaActionText">
                  <b>Enviar ao cliente</b>
                  <span className={hasSent ? 'verNotaSentText' : ''}>{sentLabel}</span>
                </div>
                {hasSent ? <CheckCircle2 size={15} /> : <ChevronRight size={15} />}
              </button>

              <button className="verNotaActionBtn verNotaDanger">
                <div className="verNotaActionIcon"><Ban size={20} /></div>
                <div className="verNotaActionText"><b>Cancelar NF-e</b><span>Disponível nas primeiras 24h após emissão</span></div>
                <ChevronRight size={15} />
              </button>
            </div>}
          </>
        ) : (
          <div className="verNotaUnavailable">
            <FileText size={36} />
            <p>Dados da nota não disponíveis nesta sessão.</p>
            <small>Para acessar os documentos, utilize o painel da Focus NFe ou gere a nota novamente para este pedido.</small>
          </div>
        )}
      </div>
    </div>
  )
}

function PrintDanfeModal({ order, onClose }) {
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState(null)
  const [printers, setPrinters] = useState([])
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [printersLoading, setPrintersLoading] = useState(true)
  const nfe = order.nfeData

  useEffect(() => {
    fetch(`${API_URL}/api/print-danfe`)
      .then((r) => r.json())
      .then((data) => {
        if (data.printers?.length) {
          setPrinters(data.printers)
          setSelectedPrinter(data.default || data.printers[0])
        }
      })
      .catch(() => {})
      .finally(() => setPrintersLoading(false))
  }, [])

  const handlePrint = async () => {
    if (!nfe?.reference) return
    setPrinting(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/print-danfe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: nfe.reference, printer: selectedPrinter || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao imprimir')
      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao enviar para impressora.')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="modalBackdrop">
      <div className="detailModal printDanfeModal">
        <div className="modalHeader">
          <div>
            <span>Impressão</span>
            <h2>Imprimir DANFE</h2>
            <p>{order.customer}{nfe?.number ? ` • NF-e nº ${nfe.number}` : ''}</p>
          </div>
          <Printer size={30} style={{ color: 'var(--navy)', opacity: .35, flexShrink: 0 }} />
        </div>
        <div className="printDanfeBody">
          {nfe?.number && (
            <div className="printDanfeInfoCard">
              <small>Documento</small>
              <b>NF-e nº {nfe.number}{nfe.series ? ` — Série ${nfe.series}` : ''}</b>
              <span>{order.customer}</span>
            </div>
          )}
          <div className="printDanfePrinterSelect">
            <label className="printDanfePrinterLabel"><Printer size={13} /> Impressora</label>
            {printersLoading ? (
              <div className="printDanfePrinterLoading">
                <Loader2 size={14} className="verNotaDetailsSpinner" /> Detectando impressoras...
              </div>
            ) : printers.length === 0 ? (
              <div className="printDanfeError">
                <AlertTriangle size={15} /> Nenhuma impressora encontrada. Verifique se o servidor está rodando localmente.
              </div>
            ) : (
              <select
                className="printDanfePrinterDropdown"
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
              >
                {printers.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>
          {error && (
            <div className="printDanfeError">
              <AlertTriangle size={15} /> {error}
            </div>
          )}
        </div>
        <div className="orderModalFooter">
          <button className="nfBtnGhost" onClick={onClose} disabled={printing}>Cancelar</button>
          <button
            className="btnSolid"
            onClick={handlePrint}
            disabled={printing || printersLoading || printers.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            {printing
              ? <><Loader2 size={16} className="verNotaDetailsSpinner" /> Imprimindo...</>
              : <><Printer size={16} /> Imprimir</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

function SupplierTranscriptModal({ supplier, onClose }) {
  const transcript = supplierTranscripts[supplier.id]
  if (!transcript) {
    return (
      <div className="nfOverlay" onClick={(e) => e.target.classList.contains('nfOverlay') && onClose()}>
        <div className="transcriptModal">
          <div className="transcriptHeader">
            <div className="transcriptHeaderInfo">
              <div className="supplierIcon small"><Factory size={16} /></div>
              <div><h3>{supplier.name}</h3><p>Sem histórico de conversa IA</p></div>
            </div>
            <div className="transcriptHeaderRight">
              <button className="nfClose" style={{position:'static'}} onClick={onClose}><X size={18} /></button>
            </div>
          </div>
          <div className="transcriptBody">
            <p style={{padding:'24px',color:'var(--muted)',textAlign:'center'}}>Nenhuma conversa registrada para este fornecedor ainda.</p>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="nfOverlay" onClick={(e) => e.target.classList.contains('nfOverlay') && onClose()}>
      <div className="transcriptModal">
        <div className="transcriptHeader">
          <div className="transcriptHeaderInfo">
            <div className="supplierIcon small"><Factory size={16} /></div>
            <div>
              <h3>{supplier.name}</h3>
              <p>{supplier.foodTypes || '—'} • {transcript ? transcript.date : ''}</p>
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
            <Bot size={14} /><span>Conversa conduzida pela IA da Saborsan com <b>{supplier.contactName || supplier.name}</b> ({supplier.contactPhone || '—'})</span>
          </div>
          <div className="transcriptMessages">
            {transcript.messages.map((msg, i) => (
              <div key={i} className={`transcriptMsg ${msg.from === 'ia' ? 'ia' : 'supplier'}`}>
                <div className="transcriptMsgAvatar">
                  {msg.from === 'ia' ? <Bot size={15} /> : supplier.name[0]}
                </div>
                <div className="transcriptMsgContent">
                  <div className="transcriptMsgMeta">
                    <b>{msg.from === 'ia' ? 'IA Saborsan' : (supplier.contactName || supplier.name)}</b>
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
            <span>Contato do fornecedor: <b>{supplier.contactPhone || '—'}</b></span>
          </div>
          <div style={{display:'flex', gap:'10px'}}>
            <button className="nfBtnGhost" onClick={onClose}>Fechar</button>
            <a className="btnSolid transcriptCallBtn" href={`tel:${(supplier.contactPhone || '').replace(/\D/g,'')}`}>
              <Smartphone size={15} /> Ligar agora
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function NewPaymentModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    clientName: '',
    orderId: '',
    sellerName: '',
    paymentDate: new Date().toISOString().slice(0, 10) + 'T08:00',
    paymentMethod: '',
    paymentValue: '',
    totalPaid: '',
    status: 'Pendente',
  })
  const [hasLinkedOrder, setHasLinkedOrder] = useState(true)
  const [clientsData, setClientsData] = useState([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [sellersData, setSellersData] = useState([])
  const [sellersLoading, setSellersLoading] = useState(true)
  const [routeOrders, setRouteOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    fetch(`${API_URL}/api/clients`)
      .then((r) => r.json())
      .then((data) => { if (data.clients) setClientsData(data.clients) })
      .catch(() => {})
      .finally(() => setClientsLoading(false))

    fetch(`${API_URL}/api/sellers`)
      .then((r) => r.json())
      .then((data) => { if (data.sellers) setSellersData(data.sellers) })
      .catch(() => {})
      .finally(() => setSellersLoading(false))

    fetch(`${API_URL}/api/orders`)
      .then((r) => r.json())
      .then((data) => { if (data.orders) setRouteOrders(data.orders.filter((o) => o.status === 'Rota')) })
      .catch(() => {})
      .finally(() => setOrdersLoading(false))
  }, [])

  const canSubmit =
    form.clientName.trim() !== '' &&
    form.sellerName !== '' &&
    form.paymentMethod !== '' &&
    form.paymentValue !== '' &&
    !isNaN(parseFloat(form.paymentValue))

  const submit = async (e) => {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitError('')
    setSubmitting(true)
    try {
      const payload = {
        clientName: form.clientName.trim(),
        orderId: hasLinkedOrder ? (form.orderId || null) : null,
        sellerName: form.sellerName,
        paymentDate: form.paymentDate.trim(),
        paymentMethod: form.paymentMethod,
        paymentValue: parseFloat(form.paymentValue),
        totalPaid: parseFloat(form.totalPaid) || 0,
        status: form.status,
      }
      const res = await fetch(`${API_URL}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao registrar pagamento')
      onCreated(data.payment)
      onClose()
    } catch (err) {
      setSubmitError(err.message || 'Erro ao salvar pagamento. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const sectionTitle = { gridColumn: '1 / -1', fontWeight: 600, fontSize: '.82rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginTop: 8, marginBottom: 0 }

  return (
    <div className="modalBackdrop">
      <div className="detailModal newProductModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>Pagamentos</span>
            <h2>Novo pagamento</h2>
            <p>Preencha os dados para registrar o pagamento no sistema</p>
          </div>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <div className="newProductScrollArea">
            <div className="newProductForm">

              <p style={sectionTitle}>Vinculação</p>
              <label className="full">Cliente *
                <CustomSelect
                  value={form.clientName}
                  onChange={(v) => set('clientName', v)}
                  placeholder={clientsLoading ? 'Carregando clientes...' : 'Selecione o cliente'}
                  disabled={clientsLoading}
                  options={clientsData.map((c) => ({ value: c.establishmentName, label: c.establishmentName }))}
                />
              </label>
              <label>Vendedor *
                <CustomSelect
                  value={form.sellerName}
                  onChange={(v) => set('sellerName', v)}
                  placeholder={sellersLoading ? 'Carregando vendedores...' : 'Selecione o vendedor'}
                  disabled={sellersLoading}
                  options={sellersData.map((s) => ({ value: s.name, label: s.name }))}
                />
              </label>
              <label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span>Pedido vinculado</span>
                  <div className="deliverySegmented">
                    <button type="button" className={`deliverySegBtn${hasLinkedOrder ? ' active' : ''}`} onClick={() => setHasLinkedOrder(true)}>Sim</button>
                    <button type="button" className={`deliverySegBtn${!hasLinkedOrder ? ' active' : ''}`} onClick={() => { setHasLinkedOrder(false); set('orderId', '') }}>Não</button>
                  </div>
                </div>
                {hasLinkedOrder && (
                  <CustomSelect
                    value={form.orderId}
                    onChange={(v) => set('orderId', v)}
                    placeholder={ordersLoading ? 'Carregando pedidos...' : routeOrders.length === 0 ? 'Nenhum pedido em Rota' : 'Selecione o pedido'}
                    disabled={ordersLoading}
                    options={routeOrders.map((o) => ({ value: o.id, label: `${o.id} — ${o.customer}` }))}
                  />
                )}
              </label>

              <p style={sectionTitle}>Dados do pagamento</p>
              <label>Data do pagamento
                <DateTimePicker value={form.paymentDate} onChange={(v) => set('paymentDate', v)} placeholder="Selecionar data e hora" />
              </label>
              <label>Forma de pagamento *
                <CustomSelect
                  value={form.paymentMethod}
                  onChange={(v) => set('paymentMethod', v)}
                  placeholder="Selecione a forma..."
                  options={[
                    { value: 'PIX', label: 'PIX' },
                    { value: 'Boleto', label: 'Boleto' },
                    { value: 'Cartão de débito', label: 'Cartão de débito' },
                    { value: 'Cartão de crédito', label: 'Cartão de crédito' },
                    { value: 'Dinheiro', label: 'Dinheiro' },
                  ]}
                />
              </label>
              <label>Valor do pagamento (R$) *
                <input type="number" min="0" step="0.01" placeholder="0,00" value={form.paymentValue} onChange={(e) => set('paymentValue', e.target.value)} required />
              </label>
              <label>Total pago (R$)
                <input type="number" min="0" step="0.01" placeholder="0,00" value={form.totalPaid} onChange={(e) => set('totalPaid', e.target.value)} />
              </label>

              <p style={sectionTitle}>Status</p>
              <label className="full">Status do pagamento *
                <CustomSelect
                  value={form.status}
                  onChange={(v) => set('status', v)}
                  options={[
                    { value: 'Pago', label: 'Pago' },
                    { value: 'Pendente', label: 'Pendente' },
                    { value: 'Parcial', label: 'Parcial' },
                    { value: 'Atrasado', label: 'Atrasado' },
                  ]}
                />
              </label>

            </div>
            {submitError && <small className="errorText" style={{ marginTop: 12, display: 'block' }}>{submitError}</small>}
          </div>
          <div className="newProductFooter">
            <button type="submit" className="btnPrimary" disabled={!canSubmit || submitting}>
              <CheckCircle2 size={17} /> {submitting ? 'Registrando...' : 'Registrar pagamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Payments({ paymentsData = [], paymentsLoading = false, onSelectPayment, onNewPayment, search = '' }) {
  const [viewMode, setViewMode] = useState('grid')
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const viewMenuRef = useRef(null)

  const filtered = !search
    ? paymentsData
    : paymentsData.filter((p) =>
        (p.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.sellerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.id || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.paymentMethod || '').toLowerCase().includes(search.toLowerCase())
      )

  useEffect(() => {
    if (!viewMenuOpen) return
    const handleClick = (e) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target)) setViewMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [viewMenuOpen])

  const viewOptions = [
    { key: 'grid', icon: LayoutGrid, label: 'Cards' },
    { key: 'list', icon: List, label: 'Lista' },
  ]

  return (
    <section className="pageStack">
      <div className="sectionHeader stockSectionHeader">
        <div><p>Registro de pagamentos</p></div>
        <div className="viewFilterWrap" ref={viewMenuRef}>
          <button className="viewFilterBtn" onClick={() => setViewMenuOpen(!viewMenuOpen)}>
            <LayoutGrid size={16} /> Visualização <ChevronDown size={14} style={{ transform: viewMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </button>
          {viewMenuOpen && (
            <div className="viewFilterDropdown">
              {viewOptions.map(({ key, icon: Icon, label }) => (
                <button key={key} className={viewMode === key ? 'active' : ''} onClick={() => { setViewMode(key); setViewMenuOpen(false) }}>
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btnSolid" onClick={onNewPayment}><Plus size={18} /> Novo pagamento</button>
      </div>
      {paymentsLoading && <p className="loadingText">Carregando pagamentos...</p>}
      {!paymentsLoading && filtered.length === 0 && <p className="emptyText">Nenhum pagamento encontrado.</p>}
      {viewMode === 'grid' ? (
        <div className="clientGrid">
          {filtered.map((payment) => (
            <article className="clientCard" key={payment.id}>
              <div className="avatar"><CreditCard size={22} /></div>
              <div>
                <h3>{payment.clientName}</h3>
                <p>{payment.id} • {payment.orderId}</p>
              </div>
              <Status status={payment.status} />
              <div className="clientStats">
                <span>Vendedor <b>{payment.sellerName}</b></span>
                <span>Data <b>{payment.paymentDate}</b></span>
                <span>Forma <b>{payment.paymentMethod}</b></span>
                <span>Valor <b>{money(payment.paymentValue)}</b></span>
              </div>
              <div className="orderActions">
                <button onClick={() => onSelectPayment && onSelectPayment(payment)}>Ver detalhes</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="clientListView">
          {filtered.map((payment) => (
            <article className="clientListItem" key={payment.id}>
              <div className="clientListAvatar"><CreditCard size={18} /></div>
              <div className="clientListInfo">
                <h3>{payment.clientName}</h3>
                <p>{payment.sellerName} • {payment.paymentMethod}</p>
              </div>
              <div className="clientListMeta">
                <span>Valor <b>{money(payment.paymentValue)}</b></span>
              </div>
              <Status status={payment.status} />
              <div className="clientListActions">
                <button onClick={() => onSelectPayment && onSelectPayment(payment)}>Ver detalhes</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function PaymentDetailModal({ payment, onClose }) {
  return (
    <div className="modalBackdrop">
      <div className="detailModal newOrderModal supplierDetailModal">
        <button className="closeBtn" onClick={onClose}><X /></button>
        <div className="modalHeader">
          <div>
            <span>Pagamento</span>
            <h2>{payment.id}</h2>
            <p>Detalhes do pagamento vinculado ao pedido {payment.orderId}</p>
          </div>
        </div>
        <div className="newOrderScrollArea">
          <h3>Cliente e vendedor</h3>
          <div className="supplierDetailGrid">
            <div className="supplierDetailItem"><span>Cliente</span><b>{payment.clientName}</b></div>
            <div className="supplierDetailItem"><span>Vendedor</span><b>{payment.sellerName}</b></div>
          </div>

          <div className="supplierDetailDivider" />

          <h3>Informações do pagamento</h3>
          <div className="supplierDetailGrid">
            <div className="supplierDetailItem">
              <span>Data do pagamento</span>
              <b>{payment.paymentDate}</b>
            </div>
            <div className="supplierDetailItem">
              <span>Forma de pagamento</span>
              <b>{payment.paymentMethod}</b>
            </div>
            <div className="supplierDetailItem">
              <span>Valor do pagamento</span>
              <b>{money(payment.paymentValue)}</b>
            </div>
            <div className="supplierDetailItem">
              <span>Total pago</span>
              <b>{money(payment.totalPaid)}</b>
            </div>
            <div className="supplierDetailItem">
              <span>Status do pagamento</span>
              <b><Status status={payment.status} /></b>
            </div>
          </div>
        </div>
        <div className="modalFooter">
          <button className="nfBtnGhost" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
