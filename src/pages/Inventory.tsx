import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { implantInventoryService } from '../services/implantInventoryService';
import { branchService } from '../services/branchService';
import { deliveryService } from '../services/deliveryService';
import { crossBranchRequestService } from '../services/crossBranchRequestService';
import { inventoryCountService } from '../services/inventoryCountService';
import { useAuth } from '../context/AuthContext';
import { getItemDisplayName } from '../utils/inventory';
import type { ImplantInventory, AbutmentInventory, InventoryItem, CrossBranchRequest, CrossBranchDeliveryStatus } from '../types';
import FixedOverlay from '../components/ui/FixedOverlay';
import {
  Package, Layers, Plus, X, AlertTriangle,
  Edit2, Trash2, ChevronLeft, ChevronRight,
  ArrowUpDown, RotateCcw, Send, Check,
  Ban, Truck, CheckCircle, FileText, Building2,
  Search, User,
  Ship, MapPin, ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../context/LanguageContext';

type Tab = 'implants' | 'abutments' | 'prosthetic' | 'materials' | 'transactions' | 'requests' | 'branches' | 'deliveries' | 'returns' | 'warehouse' | 'count';

function Badge({ children, color }: { children: React.ReactNode; color: 'green' | 'amber' | 'red' | 'cyan' | 'purple' }) {
  const map = {
    green: 'bg-green-950/30 border border-green-500/40 text-green-400',
    amber: 'bg-amber-950/30 border border-amber-500/40 text-amber-400',
    red: 'bg-red-950/30 border border-red-500/40 text-red-400',
    cyan: 'bg-cyan-950/30 border border-cyan-500/40 text-cyan-400',
    purple: 'bg-purple-950/30 border border-purple-500/40 text-purple-400',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${map[color]}`}>
      {children}
    </span>
  );
}

function AvailableBadge({ item }: { item: { quantity: number; reserved: number; used: number; minimum_stock?: number } }) {
  const { t } = useLanguage();
  const available = item.quantity - item.reserved;
  if (item.quantity === 0) {
    return <Badge color="red">{t('inventory.status_out_of_stock')}</Badge>;
  }
  if (available <= 0) {
    return <Badge color="amber">{t('inventory.status_all_reserved')}</Badge>;
  }
  if (item.minimum_stock && available <= item.minimum_stock) {
    return <Badge color="amber">{t('inventory.status_low_stock')}</Badge>;
  }
  return <Badge color="green">{t('inventory.status_in_stock')}</Badge>;
}

function StatusBadge({ status, colors }: { status: string; colors: Record<string, 'green' | 'amber' | 'red' | 'cyan' | 'purple'> }) {
  const color = colors[status] || 'amber';
  return <Badge color={color}>{status}</Badge>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function Inventory() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin' || user?.role === 'Doctor';
  const isReceptionist = user?.role === 'Receptionist';
  const isManager = user?.role === 'Manager';
  const userBranchId = user?.branch_id;
  const shouldFilterBranch = !isAdmin && !!userBranchId;
  const [tab, setTab] = useState<Tab>('implants');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'implant' | 'abutment'>('implant');
  const [editId, setEditId] = useState<string | null>(null);
  const [modalForm, setModalForm] = useState({ brand: '', size: '', type: '', quantity: 0 });
  const [customBrand, setCustomBrand] = useState(false);
  const [customSize, setCustomSize] = useState(false);
  const [customType, setCustomType] = useState(false);

  // Stock adjust modal
  const [adjustModal, setAdjustModal] = useState<{ id: string; type: 'implant' | 'abutment'; label: string } | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNotes, setAdjustNotes] = useState('');

  // Issue/Return/Adjust for new items
  const [itemActionModal, setItemActionModal] = useState<{ item: InventoryItem; action: 'issue' | 'return' | 'adjust' } | null>(null);
  const [actionQty, setActionQty] = useState(0);
  const [actionNotes, setActionNotes] = useState('');

  // Stock Request modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({ from_branch_id: '', item_id: '', item_name: '', item_category: '', quantity: 0, notes: '' });
  const [requestCategory, setRequestCategory] = useState('');

  // Add Stock modal state
  const [showAddStock, setShowAddStock] = useState(false);
  const [addStockForm, setAddStockForm] = useState({ add_item_id: '', add_category: '', add_branch_id: '', add_quantity: 0, add_notes: '' });
  const [addStockCategory, setAddStockCategory] = useState('');

  const branchFilter = shouldFilterBranch ? userBranchId : undefined;

  // Data
  const { data: implants = [], isLoading: loadI, isError: errI, refetch: refI } = useQuery({
    queryKey: ['implant-inventory', branchFilter],
    queryFn: () => implantInventoryService.getImplants(branchFilter ?? undefined),
  });
  const { data: abutments = [], isLoading: loadA, isError: errA, refetch: refA } = useQuery({
    queryKey: ['abutment-inventory', branchFilter],
    queryFn: () => implantInventoryService.getAbutments(branchFilter ?? undefined),
  });
  const { data: allItems = [], isLoading: loadItems } = useQuery({
    queryKey: ['inventory-items', branchFilter],
    queryFn: () => implantInventoryService.getInventoryItems(undefined, branchFilter ?? undefined),
  });
  const { data: allItemsUnfiltered = [] } = useQuery({
    queryKey: ['inventory-items-all'],
    queryFn: () => implantInventoryService.getInventoryItems(),
    enabled: showAddStock,
  });

  const { data: requestableItems = [] } = useQuery({
    queryKey: ['requestable-items', requestCategory, userBranchId],
    queryFn: () => crossBranchRequestService.getRequestableItems(userBranchId!, requestCategory || undefined),
    enabled: showRequestModal && !!userBranchId,
  });
  const { data: productCatalog = [] } = useQuery({
    queryKey: ['product-catalog'],
    queryFn: () => implantInventoryService.getProductCatalog(),
  });
  const { data: transactions = [], isLoading: loadT, isError: errT, refetch: refT } = useQuery({
    queryKey: ['inventory-transactions'],
    queryFn: () => implantInventoryService.getTransactions(),
  });
  const { data: allBranches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchService.getAll(),
  });

  const branches = useMemo(() => {
    if (shouldFilterBranch) return allBranches.filter(b => b.id === userBranchId);
    return allBranches;
  }, [allBranches, shouldFilterBranch, userBranchId]);

  const { data: branchInventory = [] } = useQuery({
    queryKey: ['branch-inventory-all'],
    queryFn: () => branchService.getAllBranchInventory(),
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['deliveries'],
    queryFn: () => deliveryService.getDeliveries(),
  });

  const { data: returns = [] } = useQuery({
    queryKey: ['inventory-returns'],
    queryFn: () => deliveryService.getReturns(),
  });

  const { data: crossBranchRequests = [] } = useQuery({
    queryKey: ['cross-branch-requests'],
    queryFn: () => userBranchId ? crossBranchRequestService.getByBranch(userBranchId) : crossBranchRequestService.getAll(),
    enabled: isAdmin || !!userBranchId,
  });

  const [selectedBranch, setSelectedBranch] = useState<string | null>(shouldFilterBranch ? userBranchId : null);
  const [branchSearch, setBranchSearch] = useState('');

  // Delivery form state
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [delForm, setDelForm] = useState({ to_type: 'warehouse' as 'warehouse' | 'branch', to_branch_id: '', item_id: '', item_name: '', quantity: 0, notes: '', received_by: '' });

  // Return form state
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [retForm, setRetForm] = useState({ from_location: 'branch' as 'warehouse' | 'branch' | 'patient', from_branch_id: '', item_id: '', item_name: '', quantity: 0, reason: '', notes: '' });

  // Inventory Count state
  const [showCountForm, setShowCountForm] = useState(false);
  const [countSessionName, setCountSessionName] = useState('');
  const [countBranchId, setCountBranchId] = useState<string>('');
  const [selectedCountSession, setSelectedCountSession] = useState<string | null>(null);
  const [countQtyInput, setCountQtyInput] = useState<Record<string, number>>({});

  const { data: countSessions = [] } = useQuery({
    queryKey: ['inventory-count-sessions'],
    queryFn: () => inventoryCountService.getSessions(),
  });

  const { data: countItems = [] } = useQuery({
    queryKey: ['inventory-count-items', selectedCountSession],
    queryFn: () => selectedCountSession ? inventoryCountService.getItems(selectedCountSession) : Promise.resolve([]),
    enabled: !!selectedCountSession,
  });

  const createCountSessionMut = useMutation({
    mutationFn: async () => {
      if (!countBranchId) throw new Error('Please select a branch');
      const session = await inventoryCountService.createSession({ branch_id: countBranchId, notes: countSessionName || undefined });
      const invItems = await implantInventoryService.getInventoryItems(undefined, countBranchId);
      const countItemsData = invItems.map(i => ({
        session_id: session.id,
        item_id: i.id,
        system_quantity: i.quantity,
        actual_quantity: i.quantity,
      }));
      await inventoryCountService.batchInsertItems(countItemsData);
      return session;
    },
    onSuccess: () => {
      toast.success('Count session created');
      setShowCountForm(false);
      setCountSessionName('');
      queryClient.invalidateQueries({ queryKey: ['inventory-count-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-count-items'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCountItemMut = useMutation({
    mutationFn: (data: { session_id: string; item_id: string; system_quantity: number; actual_quantity: number }) =>
      inventoryCountService.upsertItem(data),
    onSuccess: () => {
      toast.success('Count updated');
      queryClient.invalidateQueries({ queryKey: ['inventory-count-items', selectedCountSession] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveSessionMut = useMutation({
    mutationFn: ({ id, change_reason, reason_category }: { id: string; change_reason?: string; reason_category?: string }) =>
      inventoryCountService.updateSessionStatus(id, 'approved', change_reason, reason_category),
    onSuccess: () => {
      toast.success('Session approved — stock adjusted');
      queryClient.invalidateQueries({ queryKey: ['inventory-count-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-count-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['implant-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['abutment-inventory'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSessionMut = useMutation({
    mutationFn: (id: string) => inventoryCountService.deleteSession(id),
    onSuccess: () => {
      toast.success('Session deleted');
      queryClient.invalidateQueries({ queryKey: ['inventory-count-sessions'] });
      setSelectedCountSession(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Cross-branch request state

  const prostheticItems = useMemo(() => allItems.filter(i => i.category === 'prosthetic'), [allItems]);
  const materialItems = useMemo(() => allItems.filter(i => i.category === 'material'), [allItems]);

  const filteredDeliveries = useMemo(() => {
    if (!shouldFilterBranch) return deliveries;
    return deliveries.filter(d => d.to_type !== 'branch' || d.to_branch_id === userBranchId);
  }, [deliveries, shouldFilterBranch, userBranchId]);

  const filteredReturns = useMemo(() => {
    if (!shouldFilterBranch) return returns;
    return returns.filter(r => r.from_location !== 'branch' || r.from_branch_id === userBranchId);
  }, [returns, shouldFilterBranch, userBranchId]);

  const filteredTxs = useMemo(() => {
    const list = [...transactions];
    return list;
  }, [transactions]);

  const totalPages = Math.max(1, Math.ceil(filteredTxs.length / perPage));
  const pagedTxs = filteredTxs.slice((page - 1) * perPage, page * perPage);

  const lowStock = useMemo(() => {
    const i = implants.filter(x => x.quantity <= 3);
    const a = abutments.filter(x => x.quantity <= 3);
    const p = prostheticItems.filter(x => (x.quantity - x.reserved) <= (x.minimum_stock || 3));
    const m = materialItems.filter(x => (x.quantity - x.reserved) <= (x.minimum_stock || 3));
    return { total: i.length + a.length + p.length + m.length };
  }, [implants, abutments, prostheticItems, materialItems]);

  const inval = () => {
    queryClient.invalidateQueries({ queryKey: ['implant-inventory'] });
    queryClient.invalidateQueries({ queryKey: ['abutment-inventory'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['cross-branch-requests'] });
    queryClient.invalidateQueries({ queryKey: ['cross-branch-deliveries'] });
  };

  // Mutations
  const upsertImplantMut = useMutation({
    mutationFn: () => implantInventoryService.upsertImplant({ brand: modalForm.brand, size: modalForm.size, quantity: modalForm.quantity, branch_id: userBranchId }),
    onSuccess: () => { toast.success(t('inventory.toast_implant_updated')); setShowModal(false); resetModal(); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateImplantMut = useMutation({
    mutationFn: () => implantInventoryService.updateImplant(editId!, { brand: modalForm.brand, size: modalForm.size, quantity: modalForm.quantity }),
    onSuccess: () => { toast.success(t('inventory.toast_implant_edited')); setShowModal(false); resetModal(); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteImplantMut = useMutation({
    mutationFn: (id: string) => implantInventoryService.deleteImplant(id),
    onSuccess: () => { toast.success(t('inventory.toast_implant_deleted')); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const upsertAbutMut = useMutation({
    mutationFn: () => implantInventoryService.upsertAbutment({ type: modalForm.type, quantity: modalForm.quantity, branch_id: userBranchId }),
    onSuccess: () => { toast.success(t('inventory.toast_abutment_updated')); setShowModal(false); resetModal(); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateAbutMut = useMutation({
    mutationFn: () => implantInventoryService.updateAbutment(editId!, { type: modalForm.type, quantity: modalForm.quantity }),
    onSuccess: () => { toast.success(t('inventory.toast_abutment_edited')); setShowModal(false); resetModal(); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteAbutMut = useMutation({
    mutationFn: (id: string) => implantInventoryService.deleteAbutment(id),
    onSuccess: () => { toast.success(t('inventory.toast_abutment_deleted')); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const adjustMut = useMutation({
    mutationFn: ({ change_reason, reason_category }: { change_reason?: string; reason_category?: string } = {}) => {
      if (!adjustModal) throw new Error('No item');
      return adjustModal.type === 'implant'
        ? implantInventoryService.adjustImplantStock(adjustModal.id, adjustQty, adjustNotes || undefined, change_reason, reason_category)
        : implantInventoryService.adjustAbutmentStock(adjustModal.id, adjustQty, adjustNotes || undefined, change_reason, reason_category);
    },
    onSuccess: () => { toast.success(t('inventory.toast_stock_adjusted')); setAdjustModal(null); setAdjustQty(0); setAdjustNotes(''); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Item action mutations (issue/return/adjust for new items)
  const issueMut = useMutation({
    mutationFn: ({ change_reason, reason_category }: { change_reason?: string; reason_category?: string } = {}) => {
      if (!itemActionModal) throw new Error('No item');
      return implantInventoryService.issueStock(itemActionModal.item.id, actionQty, { notes: actionNotes || undefined, change_reason, reason_category });
    },
    onSuccess: () => { toast.success(t('inventory.toast_item_issued')); setItemActionModal(null); setActionQty(0); setActionNotes(''); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const returnMut = useMutation({
    mutationFn: ({ change_reason, reason_category }: { change_reason?: string; reason_category?: string } = {}) => {
      if (!itemActionModal) throw new Error('No item');
      return implantInventoryService.returnStock(itemActionModal.item.id, actionQty, { notes: actionNotes || undefined, change_reason, reason_category });
    },
    onSuccess: () => { toast.success(t('inventory.toast_item_returned')); setItemActionModal(null); setActionQty(0); setActionNotes(''); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const adjustItemMut = useMutation({
    mutationFn: ({ change_reason, reason_category }: { change_reason?: string; reason_category?: string } = {}) => {
      if (!itemActionModal) throw new Error('No item');
      return implantInventoryService.adjustStock(itemActionModal.item.id, actionQty, actionNotes || undefined, change_reason, reason_category);
    },
    onSuccess: () => { toast.success(t('inventory.toast_stock_adjusted')); setItemActionModal(null); setActionQty(0); setActionNotes(''); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addStockMut = useMutation({
    mutationFn: ({ change_reason, reason_category }: { change_reason?: string; reason_category?: string } = {}) => {
      const item = allItemsUnfiltered.find(i => i.id === addStockForm.add_item_id);
      if (!item) throw new Error('Item not found');
      return implantInventoryService.addStockToBranch({
        category: item.category,
        subcategory: item.subcategory,
        name: item.name,
        brand: item.brand,
        size: item.size,
        unit: item.unit,
        branch_id: addStockForm.add_branch_id,
        quantity: addStockForm.add_quantity,
        notes: addStockForm.add_notes || undefined,
        change_reason,
        reason_category,
      });
    },
    onSuccess: () => { toast.success('Stock added'); setShowAddStock(false); setAddStockForm({ add_item_id: '', add_category: '', add_branch_id: '', add_quantity: 0, add_notes: '' }); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createRequestMut = useMutation({
    mutationFn: () => crossBranchRequestService.create({
      from_branch_id: requestForm.from_branch_id,
      to_branch_id: userBranchId!,
      item_id: requestForm.item_id || undefined,
      item_name: requestForm.item_name,
      item_category: requestForm.item_category || undefined,
      quantity: requestForm.quantity,
      notes: requestForm.notes || undefined,
    }),
    onSuccess: () => { toast.success(t('inventory.toast_request_created')); setShowRequestModal(false); setRequestForm({ from_branch_id: '', item_id: '', item_name: '', item_category: '', quantity: 0, notes: '' }); setRequestCategory(''); inval(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delivery mutation
  const createDeliveryMut = useMutation({
    mutationFn: () => deliveryService.createDelivery(delForm),
    onSuccess: () => {
      toast.success(t('delivery.toast_created'));
      setShowDeliveryForm(false);
      setDelForm({ to_type: 'warehouse', to_branch_id: '', item_id: '', item_name: '', quantity: 0, notes: '', received_by: '' });
      inval();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Return mutation
  const createReturnMut = useMutation({
    mutationFn: () => deliveryService.createReturn(retForm),
    onSuccess: () => {
      toast.success(t('returns.toast_created'));
      setShowReturnForm(false);
      setRetForm({ from_location: 'branch', from_branch_id: '', item_id: '', item_name: '', quantity: 0, reason: '', notes: '' });
      inval();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateWHMut = useMutation({
    mutationFn: async ({ id, status, change_reason, reason_category }: { id: string; status: CrossBranchRequest['status']; change_reason?: string; reason_category?: string }) => {
      if (status === 'approved') {
        await crossBranchRequestService.approveRequest(id, user?.id, change_reason, reason_category);
      } else {
        await crossBranchRequestService.updateStatus(id, status, user?.id, change_reason, reason_category);
      }
    },
    onSuccess: () => {
      toast.success('Request updated');
      queryClient.invalidateQueries({ queryKey: ['cross-branch-requests'] });
      queryClient.invalidateQueries({ queryKey: ['cross-branch-deliveries'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateDeliveryMut = useMutation({
    mutationFn: ({ id, status, change_reason, reason_category }: { id: string; status: CrossBranchDeliveryStatus; change_reason?: string; reason_category?: string }) =>
      crossBranchRequestService.updateDeliveryStatus(id, status, change_reason, reason_category),
    onSuccess: () => {
      toast.success('Delivery updated');
      queryClient.invalidateQueries({ queryKey: ['cross-branch-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['cross-branch-requests'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Fetch deliveries for warehouse requests
  const { data: warehouseDeliveries = [] } = useQuery({
    queryKey: ['cross-branch-deliveries'],
    queryFn: () => crossBranchRequestService.getDeliveriesForBranches(),
    enabled: isAdmin || !!userBranchId,
  });

  // For the request modal: find branches with stock of the selected item
  const availableBranches = useMemo(() => {
    if (!requestForm.item_id) return [];
    const catalogItem = productCatalog.find(i => i.id === requestForm.item_id);
    if (!catalogItem) return [];
    return requestableItems
      .filter(i =>
        i.quantity > 0 &&
        i.category === catalogItem.category &&
        i.subcategory === catalogItem.subcategory &&
        i.name === catalogItem.name &&
        i.brand === catalogItem.brand &&
        i.size === catalogItem.size
      )
      .map(i => ({
        branch_id: i.branch_id,
        branch_name: allBranches.find(b => b.id === i.branch_id)?.name || 'Unknown',
        qty: i.quantity,
      }));
  }, [requestForm.item_id, productCatalog, requestableItems, allBranches]);

  const resetModal = () => { setEditId(null); setModalForm({ brand: '', size: '', type: '', quantity: 0 }); setCustomBrand(false); setCustomSize(false); setCustomType(false); };

  const openCreate = (type: 'implant' | 'abutment') => {
    resetModal(); setModalMode(type); setShowModal(true);
  };

  const openEdit = (type: 'implant' | 'abutment', item: ImplantInventory | AbutmentInventory) => {
    setModalMode(type);
    if (type === 'implant') {
      const i = item as ImplantInventory;
      setModalForm({ brand: i.brand, size: i.size, type: '', quantity: i.quantity });
    } else {
      const a = item as AbutmentInventory;
      setModalForm({ brand: '', size: '', type: a.type, quantity: a.quantity });
    }
    setEditId(item.id);
    setShowModal(true);
  };

  const requestStatusBadgeColors: Record<string, 'green' | 'amber' | 'red' | 'cyan' | 'purple'> = {
    pending: 'amber',
    approved: 'green',
    rejected: 'red',
    delivered: 'cyan',
    completed: 'purple',
  };

  const deliveryStatusBadgeColors: Record<string, 'green' | 'amber' | 'red' | 'cyan' | 'purple'> = {
    preparing: 'amber',
    picked_up: 'cyan',
    in_transit: 'cyan',
    arrived: 'green',
    completed: 'purple',
  };

  const tabs = useMemo(() => [
    { key: 'implants' as Tab, label: t('inventory.tab_implants'), icon: Package },
    { key: 'abutments' as Tab, label: t('inventory.tab_abutments'), icon: Layers },
    { key: 'prosthetic' as Tab, label: t('inventory.tab_prosthetic'), icon: Layers },
    { key: 'materials' as Tab, label: t('inventory.tab_materials'), icon: FileText },
    { key: 'transactions' as Tab, label: t('inventory.tab_transactions'), icon: ArrowUpDown },
    { key: 'requests' as Tab, label: t('inventory.tab_requests'), icon: Send },
    { key: 'branches' as Tab, label: t('inventory.tab_branches'), icon: Building2 },

    { key: 'deliveries' as Tab, label: t('inventory.tab_deliveries'), icon: Truck },
    { key: 'returns' as Tab, label: t('inventory.tab_returns'), icon: RotateCcw },
    { key: 'count' as Tab, label: 'Inventory Count', icon: ClipboardList },
  ].filter(t => t.key !== 'returns'), [t]);

  const prostheticLabels = useMemo(() => ({
    healing_abutment: t('inventory.prosthetic_healing_abutment'),
    cover_screw: t('inventory.prosthetic_cover_screw'),
    transfer: t('inventory.prosthetic_transfer'),
    analog: t('inventory.prosthetic_analog'),
    scan_body: t('inventory.prosthetic_scan_body'),
    multi_unit: t('inventory.prosthetic_multi_unit'),
    lab_analog: t('inventory.prosthetic_lab_analog'),
  }), [t]);

  const materialLabels = useMemo(() => ({
    bone_graft: t('inventory.material_bone_graft'),
    membrane: t('inventory.material_membrane'),
    sutures: t('inventory.material_sutures'),
    saline: t('inventory.material_saline'),
    anesthetic: t('inventory.material_anesthetic'),
    gloves: t('inventory.material_gloves'),
    surgical_kit: t('inventory.material_surgical_kit'),
    other: t('inventory.material_other'),
  }), [t]);

  // ─── Shared table helpers ───
  function TableHeader({ children }: { children: React.ReactNode }) {
    return (
      <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-white/5 text-white/25">
        {children}
      </div>
    );
  }

  function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
      <div className="py-16 text-center text-sm text-red-400">
        {message}{' '}
        <button onClick={() => onRetry()} className="underline text-cyan-400" aria-label="Retry">
          {t('common.retry')}
        </button>
      </div>
    );
  }

  function EmptyState({ message }: { message: string }) {
    return <div className="py-16 text-center text-sm text-white/30">{message}</div>;
  }

  return (
    <div className="font-sans select-auto space-y-5">
      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{t('inventory.title')}</h1>
          <p className="text-sm mt-1 text-white/45">
            {t('inventory.subtitle', { count: implants.length + abutments.length + allItems.length })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {lowStock.total > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-950/30 border border-red-500/20 text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" /> {t('inventory.low_stock_badge', { count: lowStock.total })}
            </div>
          )}
          {isAdmin && (
            <button
              onClick={() => { setShowAddStock(true); setAddStockForm({ add_item_id: '', add_category: '', add_branch_id: '', add_quantity: 0, add_notes: '' }); }}
              className="btn-primary btn-sm"
              aria-label="Add Stock to Branch"
            >
              <Plus className="w-4 h-4" /> Add Stock to Branch
            </button>
          )}
          {isReceptionist && (
            <button
              onClick={() => setShowRequestModal(true)}
              className="btn-primary btn-sm"
              aria-label="Stock Request"
            >
              <Send className="w-4 h-4" /> {t('inventory.stock_request')}
            </button>
          )}
          {isAdmin && tab === 'implants' && (
            <button
              onClick={() => openCreate('implant')}
              className="btn-primary btn-sm"
              aria-label={t('inventory.add_implant')}
            >
              <Plus className="w-4 h-4" /> {t('inventory.add_implant')}
            </button>
          )}
          {isAdmin && tab === 'abutments' && (
            <button
              onClick={() => openCreate('abutment')}
              className="btn-primary btn-sm"
              aria-label={t('inventory.add_abutment')}
            >
              <Plus className="w-4 h-4" /> {t('inventory.add_abutment')}
            </button>
          )}
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div
        className="flex gap-1 p-1 rounded-xl overflow-x-auto bg-white/[0.03] border border-white/5"
        role="tablist"
        aria-label="Inventory tabs"
      >
        {tabs.map(tabItem => {
          const Icon = tabItem.icon;
          const isActive = tab === tabItem.key;
          return (
            <button
              key={tabItem.key}
              onClick={() => { setTab(tabItem.key); setPage(1); }}
              role="tab"
              aria-selected={isActive}
              aria-label={tabItem.label}
              className={`flex-1 min-w-[100px] h-9 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold transition-all whitespace-nowrap ${
                isActive ? 'bg-cyan-500/10 text-cyan-400 shadow-sm' : 'bg-transparent text-white/40 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {tabItem.label}
            </button>
          );
        })}
      </div>

      {/* ─── IMPLANTS TABLE ─── */}
      {tab === 'implants' && (
        <div className="overflow-x-auto rounded-2xl glass-strong">
          <div className="min-w-[500px]">
            <TableHeader>
              <div className="flex-[2]">{t('inventory.implants_brand')}</div>
              <div className="flex-[2]">{t('inventory.implants_size')}</div>
              <div className="flex-[1]">{t('inventory.col_total')}</div>
              <div className="flex-[1]">{t('inventory.col_avail')}</div>
              <div className="flex-[2]">{t('inventory.col_status')}</div>
              {isAdmin && <div className="w-20">{t('inventory.col_actions')}</div>}
            </TableHeader>
            <div className="divide-y divide-white/5">
              {loadI ? (
                <Spinner />
              ) : errI ? (
                <ErrorState message={t('inventory.empty_failed')} onRetry={() => refI()} />
              ) : implants.length === 0 ? (
                <EmptyState message={t('inventory.empty_implants')} />
              ) : implants.map(i => {
                const available = i.quantity - (i.reserved || 0);
                return (
                  <div key={i.id} className="flex items-center px-6 py-4 hover:bg-[var(--app-table-hover)] transition-colors">
                    <div className="flex-[2] text-sm font-medium text-white">{i.brand}</div>
                    <div className="flex-[2] text-sm text-white/60">{i.size}</div>
                    <div className="flex-[1] text-sm font-bold text-white font-mono">{i.quantity}</div>
                    <div className={`flex-[1] text-sm font-mono ${available > 0 ? 'text-green-400' : 'text-red-400'}`}>{available}</div>
                    <div className="flex-[2]"><AvailableBadge item={{ ...i, reserved: i.reserved || 0, used: i.used || 0 }} /></div>
                    {isAdmin && (
                      <div className="w-20 flex items-center gap-1">
                        <button
                          onClick={() => setAdjustModal({ id: i.id, type: 'implant', label: getItemDisplayName(i) })}
                          className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-white/40 hover:text-white"
                          aria-label="Adjust stock"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEdit('implant', i)}
                          className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-white/40 hover:text-white"
                          aria-label="Edit implant"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm(t('inventory.confirm_delete_implant'))) deleteImplantMut.mutate(i.id); }}
                          className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-white/40 hover:text-red-400"
                          aria-label="Delete implant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── ABUTMENTS TABLE ─── */}
      {tab === 'abutments' && (
        <div className="overflow-x-auto rounded-2xl glass-strong">
          <div className="min-w-[500px]">
            <TableHeader>
              <div className="flex-[3]">{t('inventory.abutments_type')}</div>
              <div className="flex-[1]">{t('inventory.col_total')}</div>
              <div className="flex-[1]">{t('inventory.col_avail')}</div>
              <div className="flex-[2]">{t('inventory.col_status')}</div>
              {isAdmin && <div className="w-20">{t('inventory.col_actions')}</div>}
            </TableHeader>
            <div className="divide-y divide-white/5">
              {loadA ? (
                <Spinner />
              ) : errA ? (
                <ErrorState message={t('inventory.empty_failed')} onRetry={() => refA()} />
              ) : abutments.length === 0 ? (
                <EmptyState message={t('inventory.empty_abutments')} />
              ) : abutments.map(a => {
                const available = a.quantity - (a.reserved || 0);
                return (
                  <div key={a.id} className="flex items-center px-6 py-4 hover:bg-[var(--app-table-hover)] transition-colors">
                    <div className="flex-[3] text-sm font-medium text-white">{a.type}</div>
                    <div className="flex-[1] text-sm font-bold text-white font-mono">{a.quantity}</div>
                    <div className={`flex-[1] text-sm font-mono ${available > 0 ? 'text-green-400' : 'text-red-400'}`}>{available}</div>
                    <div className="flex-[2]"><AvailableBadge item={{ ...a, reserved: a.reserved || 0, used: a.used || 0 }} /></div>
                    {isAdmin && (
                      <div className="w-20 flex items-center gap-1">
                        <button
                          onClick={() => setAdjustModal({ id: a.id, type: 'abutment', label: a.type })}
                          className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-white/40 hover:text-white"
                          aria-label="Adjust stock"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEdit('abutment', a)}
                          className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-white/40 hover:text-white"
                          aria-label="Edit abutment"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm(t('inventory.confirm_delete_abutment'))) deleteAbutMut.mutate(a.id); }}
                          className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-white/40 hover:text-red-400"
                          aria-label="Delete abutment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── PROSTHETIC TABLE ─── */}
      {tab === 'prosthetic' && (
        <div className="overflow-x-auto rounded-2xl glass-strong">
          <div className="min-w-[600px]">
            <TableHeader>
              <div className="flex-[2]">{t('inventory.abutments_type')}</div>
              <div className="flex-[1]">{t('inventory.col_total')}</div>
              <div className="flex-[1]">{t('inventory.col_avail')}</div>
              <div className="flex-[1]">{t('inventory.col_reserved')}</div>
              <div className="flex-[1]">{t('inventory.col_used')}</div>
              <div className="flex-[1.5]">{t('inventory.col_status')}</div>
              {isAdmin && <div className="w-20">{t('inventory.col_actions')}</div>}
            </TableHeader>
            <div className="divide-y divide-white/5">
              {loadItems ? (
                <Spinner />
              ) : prostheticItems.length === 0 ? (
                <EmptyState message={t('inventory.empty_prosthetic')} />
              ) : prostheticItems.map(i => {
                const available = i.quantity - i.reserved;
                return (
                  <div key={i.id} className="flex items-center px-6 py-4 hover:bg-[var(--app-table-hover)] transition-colors">
                    <div className="flex-[2] text-sm font-medium text-white">{prostheticLabels[i.subcategory as keyof typeof prostheticLabels] || i.subcategory || i.name}</div>
                    <div className="flex-[1] text-sm font-bold text-white font-mono">{i.quantity}</div>
                    <div className={`flex-[1] text-sm font-mono ${available > 0 ? 'text-green-400' : 'text-red-400'}`}>{available}</div>
                    <div className="flex-[1] text-sm font-mono text-amber-400">{i.reserved}</div>
                    <div className="flex-[1] text-sm font-mono text-white/50">{i.used}</div>
                    <div className="flex-[1.5]"><AvailableBadge item={i} /></div>
                    {isAdmin && (
                      <div className="w-20 flex items-center gap-1">
                        <button
                          onClick={() => setItemActionModal({ item: i, action: 'issue' })}
                          className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-red-400 hover:bg-red-950/20"
                          aria-label={t('inventory.tooltip_issue')}
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setItemActionModal({ item: i, action: 'return' })}
                          className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-green-400 hover:bg-green-950/20"
                          aria-label={t('inventory.tooltip_return')}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setItemActionModal({ item: i, action: 'adjust' })}
                          className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-white/40 hover:text-white"
                          aria-label={t('inventory.tooltip_adjust')}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── MATERIALS TABLE ─── */}
      {tab === 'materials' && (
        <div className="overflow-x-auto rounded-2xl glass-strong">
          <div className="min-w-[600px]">
            <TableHeader>
              <div className="flex-[2]">{t('inventory.abutments_type')}</div>
              <div className="flex-[1]">{t('inventory.col_total')}</div>
              <div className="flex-[1]">{t('inventory.col_avail')}</div>
              <div className="flex-[1]">{t('inventory.col_reserved')}</div>
              <div className="flex-[1]">{t('inventory.col_used')}</div>
              <div className="flex-[1.5]">{t('inventory.col_status')}</div>
              {isAdmin && <div className="w-20">{t('inventory.col_actions')}</div>}
            </TableHeader>
            <div className="divide-y divide-white/5">
              {loadItems ? (
                <Spinner />
              ) : materialItems.length === 0 ? (
                <EmptyState message={t('inventory.empty_materials')} />
              ) : materialItems.map(i => {
                const available = i.quantity - i.reserved;
                return (
                  <div key={i.id} className="flex items-center px-6 py-4 hover:bg-[var(--app-table-hover)] transition-colors">
                    <div className="flex-[2] text-sm font-medium text-white">{materialLabels[i.subcategory as keyof typeof materialLabels] || i.subcategory || i.name}</div>
                    <div className="flex-[1] text-sm font-bold text-white font-mono">{i.quantity}</div>
                    <div className={`flex-[1] text-sm font-mono ${available > 0 ? 'text-green-400' : 'text-red-400'}`}>{available}</div>
                    <div className="flex-[1] text-sm font-mono text-amber-400">{i.reserved}</div>
                    <div className="flex-[1] text-sm font-mono text-white/50">{i.used}</div>
                    <div className="flex-[1.5]"><AvailableBadge item={i} /></div>
                    {isAdmin && (
                      <div className="w-20 flex items-center gap-1">
                        <button
                          onClick={() => setItemActionModal({ item: i, action: 'issue' })}
                          className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-red-400 hover:bg-red-950/20"
                          aria-label={t('inventory.tooltip_issue')}
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setItemActionModal({ item: i, action: 'return' })}
                          className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-green-400 hover:bg-green-950/20"
                          aria-label={t('inventory.tooltip_return')}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setItemActionModal({ item: i, action: 'adjust' })}
                          className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-white/40 hover:text-white"
                          aria-label={t('inventory.tooltip_adjust')}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── TRANSACTIONS TABLE ─── */}
      {tab === 'transactions' && (
        <div className="overflow-x-auto rounded-2xl glass-strong">
          <div className="min-w-[600px]">
            <TableHeader>
              <div className="flex-[1.5]">{t('inventory.col_item')}</div>
              <div className="flex-[1]">{t('inventory.col_operation')}</div>
              <div className="flex-[1]">{t('inventory.col_qty')}</div>
              <div className="flex-[1.5]">{t('inventory.col_notes')}</div>
              <div className="flex-[1.5]">{t('inventory.col_date')}</div>
            </TableHeader>
            <div className="divide-y divide-white/5">
              {loadT ? (
                <Spinner />
              ) : errT ? (
                <ErrorState message={t('inventory.empty_failed')} onRetry={() => refT()} />
              ) : pagedTxs.length === 0 ? (
                <EmptyState message={t('inventory.empty_transactions')} />
              ) : pagedTxs.map(tx => {
                const opBadgeColors: Record<string, 'green' | 'red' | 'cyan' | 'amber'> = { add: 'green', issue: 'red', return: 'cyan', adjust: 'amber' };
                const badgeColor = opBadgeColors[tx.operation_type] || 'amber';
                return (
                  <div key={tx.id} className="flex items-center px-6 py-4 hover:bg-[var(--app-table-hover)] transition-colors">
                    <div className="flex-[1.5] text-sm text-white/60">{tx.item_name || tx.item_type}</div>
                    <div className="flex-[1]">
                      <Badge color={badgeColor}>{tx.operation_type}</Badge>
                    </div>
                    <div className="flex-[1] text-sm font-bold text-white font-mono">{tx.quantity}</div>
                    <div className="flex-[1.5] text-xs text-white/45">{tx.notes || t('common.dash')}</div>
                    <div className="flex-[1.5] text-xs text-white/35">
                      {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : t('common.dash')}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredTxs.length > perPage && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
                <span className="text-xs text-white/35">
                  {t('common.page_n_of_total', { n: page, total: totalPages })}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="btn-ghost btn-xs !w-8 !h-8 !p-0 disabled:opacity-30"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="btn-ghost btn-xs !w-8 !h-8 !p-0 disabled:opacity-30"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── REQUESTS TAB (cross-branch) ─── */}
      {tab === 'requests' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowRequestModal(true)}
              className="btn-primary btn-sm"
              aria-label="New Request"
            >
              <Send className="w-3.5 h-3.5" /> New Request
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl glass-strong">
            <div className="min-w-[800px]">
              <TableHeader>
                <div className="flex-[1.5]">From Branch</div>
                <div className="flex-[1.5]">To Branch</div>
                <div className="flex-[1.5]">Item</div>
                <div className="flex-[0.8]">Qty</div>
                <div className="flex-[1]">Status</div>
                <div className="flex-[1.5]">Date</div>
                <div className="w-28 text-right">Actions</div>
              </TableHeader>
              <div className="divide-y divide-white/5">
                {crossBranchRequests.length === 0 ? (
                  <EmptyState message="No requests yet" />
                ) : crossBranchRequests.map(r => {
                  const isIncoming = r.from_branch_id === userBranchId && r.status === 'pending';
                  return (
                    <div key={r.id} className="flex items-center px-6 py-4 hover:bg-[var(--app-table-hover)] transition-colors">
                      <div className="flex-[1.5] text-sm font-medium text-white">{r.from_branch_name || '—'}</div>
                      <div className="flex-[1.5] text-sm font-medium text-white">{r.to_branch_name || '—'}</div>
                      <div className="flex-[1.5] text-sm text-white/60">{r.item_name}</div>
                      <div className="flex-[0.8] text-sm font-bold text-white font-mono">{r.quantity}</div>
                      <div className="flex-[1]">
                        <StatusBadge status={r.status} colors={requestStatusBadgeColors} />
                      </div>
                      <div className="flex-[1.5] text-xs text-white/35">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                      </div>
                      <div className="w-28 flex items-center justify-end gap-1">
                        {isIncoming ? (
                          <>
                            <button
                              onClick={() => updateWHMut.mutate({ id: r.id, status: 'approved' })}
                              className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-green-400 hover:bg-green-950/20"
                              title="Approve"
                              aria-label="Approve request"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => updateWHMut.mutate({ id: r.id, status: 'rejected' })}
                              className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-red-400 hover:bg-red-950/20"
                              title="Reject"
                              aria-label="Reject request"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-white/20">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── BRANCHES TAB ─── */}
      {tab === 'branches' && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {!shouldFilterBranch && (
              <button
                onClick={() => setSelectedBranch(null)}
                className={`flex-shrink-0 h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  !selectedBranch ? 'bg-cyan-500/10 text-cyan-400' : 'bg-white/[0.03] text-white/40 hover:text-white/60'
                }`}
                aria-label={t('branches.all_branches')}
              >
                {t('branches.all_branches')}
              </button>
            )}
            {branches.filter(b => b.is_active).map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBranch(b.id)}
                className={`flex-shrink-0 h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedBranch === b.id ? 'bg-cyan-500/10 text-cyan-400' : 'bg-white/[0.03] text-white/40 hover:text-white/60'
                }`}
                aria-label={b.name}
              >
                {b.name}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={branchSearch}
              onChange={e => setBranchSearch(e.target.value)}
              placeholder={t('branches.search_placeholder')}
              className="input-cyber pl-10"
              aria-label="Search branches"
            />
          </div>
          <div className="overflow-x-auto rounded-2xl glass-strong">
            <div className="min-w-[700px]">
              <TableHeader>
                <div className="flex-[2]">{t('branches.col_branch')}</div>
                <div className="flex-[2]">{t('branches.col_item')}</div>
                <div className="flex-[1.5]">{t('branches.col_category')}</div>
                <div className="flex-[1]">{t('branches.col_quantity')}</div>
                <div className="flex-[1]">{t('branches.col_reserved')}</div>
                <div className="flex-[1.5]">{t('branches.col_status')}</div>
              </TableHeader>
              <div className="divide-y divide-white/5">
                {(() => {
                  let items = branchInventory;
                  if (shouldFilterBranch) items = items.filter(i => i.branch_id === userBranchId);
                  if (selectedBranch) items = items.filter(i => i.branch_id === selectedBranch);
                  if (branchSearch) { const q = branchSearch.toLowerCase(); items = items.filter(i => (i.item_name || '').toLowerCase().includes(q) || (i.branch_name || '').toLowerCase().includes(q)); }
                  return items.length === 0 ? (
                    <EmptyState message={t('branches.empty')} />
                  ) : items.map(item => {
                    const available = item.quantity - item.reserved;
                    return (
                      <div key={item.id} className="flex items-center px-6 py-4 hover:bg-[var(--app-table-hover)] transition-colors">
                        <div className="flex-[2] text-sm font-medium text-white">{item.branch_name || '—'}</div>
                        <div className="flex-[2] text-sm text-white/60">{item.item_name || '—'}</div>
                        <div className="flex-[1.5] text-xs text-white/40">{item.item_category || '—'}</div>
                        <div className="flex-[1] text-sm font-bold text-white font-mono">{item.quantity}</div>
                        <div className="flex-[1] text-sm font-mono text-amber-400">{item.reserved}</div>
                        <div className="flex-[1.5]">
                          {item.quantity === 0 ? (
                            <Badge color="red">{t('branches.status_out')}</Badge>
                          ) : available <= 3 ? (
                            <Badge color="amber"><AlertTriangle className="w-3 h-3" /> {t('branches.status_low')}</Badge>
                          ) : (
                            <Badge color="green">{t('branches.status_ok')}</Badge>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELIVERIES TAB ─── */}
      {tab === 'deliveries' && (
        <div className="space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowDeliveryForm(true)}
                className="btn-primary btn-sm"
                aria-label={t('delivery.new_delivery')}
              >
                <Plus className="w-3.5 h-3.5" /> {t('delivery.new_delivery')}
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-2xl glass-strong">
            <div className="min-w-[700px]">
              <TableHeader>
                <div className="flex-[1.5]">{t('delivery.col_item')}</div>
                <div className="flex-[1]">{t('delivery.col_qty')}</div>
                <div className="flex-[1.5]">{t('delivery.col_to')}</div>
                <div className="flex-[1.5]">{t('delivery.col_received_by')}</div>
                <div className="flex-[1]">{t('delivery.col_notes')}</div>
                <div className="flex-[1.5]">{t('delivery.col_date')}</div>
              </TableHeader>
              <div className="divide-y divide-white/5">
                {filteredDeliveries.length === 0 ? (
                  <EmptyState message={t('delivery.empty')} />
                ) : filteredDeliveries.map(d => (
                  <div key={d.id} className="flex items-center px-6 py-4 hover:bg-[var(--app-table-hover)] transition-colors">
                    <div className="flex-[1.5] text-sm font-medium text-white">{d.item_name}</div>
                    <div className="flex-[1] text-sm font-bold text-white font-mono">{d.quantity}</div>
                    <div className="flex-[1.5] text-sm flex items-center gap-1.5 text-white/60">
                      {d.to_type === 'branch' ? <Building2 className="w-3.5 h-3.5 text-cyan-400" /> : <Package className="w-3.5 h-3.5 text-amber-400" />}
                      {d.to_type === 'branch' ? d.branch_name || '—' : t('delivery.warehouse')}
                    </div>
                    <div className="flex-[1.5] text-sm text-white/50">{d.received_by || '—'}</div>
                    <div className="flex-[1] text-xs text-white/45">{d.notes || '—'}</div>
                    <div className="flex-[1.5] text-xs text-white/35">
                      {d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Cross-branch deliveries */}
          {warehouseDeliveries.length > 0 && (
            <div className="overflow-x-auto rounded-2xl glass-strong">
              <div className="min-w-[800px]">
                <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/25">Cross-Branch Deliveries</span>
                </div>
                <TableHeader>
                  <div className="flex-[1.5]">Item</div>
                  <div className="flex-[0.8]">Qty</div>
                  <div className="flex-[1.5]">From</div>
                  <div className="flex-[1.5]">To</div>
                  <div className="flex-[1.5]">Status</div>
                  <div className="flex-[1.5]">Date</div>
                  {(isManager || isAdmin) && <div className="w-36 text-right">Actions</div>}
                </TableHeader>
                <div className="divide-y divide-white/5">
                  {warehouseDeliveries.map(d => {
                    const req = d.request;
                    const isFromBranch = req?.from_branch_id === userBranchId;
                    const isToBranch = req?.to_branch_id === userBranchId;
                    return (
                      <div key={d.id} className="flex items-center px-6 py-3.5 hover:bg-[var(--app-table-hover)] transition-colors">
                        <div className="flex-[1.5] text-sm font-medium text-white">{req?.item_name || '—'}</div>
                        <div className="flex-[0.8] text-sm font-bold text-white font-mono">{req?.quantity || '—'}</div>
                        <div className="flex-[1.5] text-sm text-white/60">{req?.from_branch_name || '—'}</div>
                        <div className="flex-[1.5] text-sm text-white/60">{req?.to_branch_name || '—'}</div>
                        <div className="flex-[1.5]">
                          <StatusBadge status={d.status} colors={deliveryStatusBadgeColors} />
                        </div>
                        <div className="flex-[1.5] text-xs text-white/35">
                          {d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}
                        </div>
                        {(isManager || isAdmin) && (
                          <div className="w-36 flex items-center justify-end gap-1">
                            {d.status === 'preparing' && isFromBranch && (
                              <button
                                onClick={() => updateDeliveryMut.mutate({ id: d.id, status: 'picked_up' })}
                                className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-cyan-400 hover:bg-cyan-950/20"
                                title="Picked Up"
                                aria-label="Mark as picked up"
                              >
                                <Package className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {d.status === 'picked_up' && isFromBranch && (
                              <button
                                onClick={() => updateDeliveryMut.mutate({ id: d.id, status: 'in_transit' })}
                                className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-cyan-400 hover:bg-cyan-950/20"
                                title="In Transit"
                                aria-label="Mark as in transit"
                              >
                                <Ship className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {d.status === 'in_transit' && isToBranch && (
                              <button
                                onClick={() => updateDeliveryMut.mutate({ id: d.id, status: 'arrived' })}
                                className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-green-400 hover:bg-green-950/20"
                                title="Arrived"
                                aria-label="Mark as arrived"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {d.status === 'arrived' && isToBranch && (
                              <button
                                onClick={() => updateDeliveryMut.mutate({ id: d.id, status: 'completed' })}
                                className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-purple-400 hover:bg-purple-950/20"
                                title="Complete"
                                aria-label="Mark as completed"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── RETURNS TAB ─── */}
      {tab === 'returns' && (
        <div className="space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowReturnForm(true)}
                className="btn-primary btn-sm"
                aria-label={t('returns.new_return')}
              >
                <Plus className="w-3.5 h-3.5" /> {t('returns.new_return')}
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-2xl glass-strong">
            <div className="min-w-[700px]">
              <TableHeader>
                <div className="flex-[1.5]">{t('returns.col_item')}</div>
                <div className="flex-[1]">{t('returns.col_qty')}</div>
                <div className="flex-[1.5]">{t('returns.col_from')}</div>
                <div className="flex-[1.5]">{t('returns.col_reason')}</div>
                <div className="flex-[1]">{t('returns.col_notes')}</div>
                <div className="flex-[1.5]">{t('returns.col_date')}</div>
              </TableHeader>
              <div className="divide-y divide-white/5">
                {filteredReturns.length === 0 ? (
                  <EmptyState message={t('returns.empty')} />
                ) : filteredReturns.map(r => (
                  <div key={r.id} className="flex items-center px-6 py-4 hover:bg-[var(--app-table-hover)] transition-colors">
                    <div className="flex-[1.5] text-sm font-medium text-white">{r.item_name}</div>
                    <div className="flex-[1] text-sm font-bold text-white font-mono">{r.quantity}</div>
                    <div className="flex-[1.5] text-sm flex items-center gap-1.5 text-white/60">
                      {r.from_location === 'branch' ? <Building2 className="w-3.5 h-3.5" /> : r.from_location === 'patient' ? <User className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                      {r.from_location === 'branch' ? (r.branch_name || '—') : r.from_location}
                    </div>
                    <div className="flex-[1.5] text-xs text-white/50">{r.reason || '—'}</div>
                    <div className="flex-[1] text-xs text-white/45">{r.notes || '—'}</div>
                    <div className="flex-[1.5] text-xs text-white/35">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── COUNT TAB ─── */}
      {tab === 'count' && (
        <div className="space-y-4">
          {(isAdmin || isManager) && (
            <div className="flex justify-end">
              <button
                onClick={() => { setShowCountForm(true); setCountSessionName(''); setCountBranchId(userBranchId || ''); }}
                className="btn-primary btn-sm"
                aria-label="New Count Session"
              >
                <ClipboardList className="w-3.5 h-3.5" /> New Count Session
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-2xl glass-strong">
            <div className="min-w-[600px]">
              <TableHeader>
                <div className="flex-[2]">Session Name</div>
                <div className="flex-[1]">Branch</div>
                <div className="flex-[1]">Status</div>
                <div className="flex-[1.5]">Created</div>
                <div className="w-28 text-right">Actions</div>
              </TableHeader>
              <div className="divide-y divide-white/5">
                {countSessions.length === 0 ? (
                  <EmptyState message="No count sessions yet" />
                ) : countSessions.map(s => (
                  <div key={s.id}>
                    <div
                      className="flex items-center px-6 py-3.5 cursor-pointer hover:bg-[var(--app-table-hover)] transition-colors"
                      onClick={() => setSelectedCountSession(selectedCountSession === s.id ? null : s.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Toggle session ${s.notes || 'Count Session'}`}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCountSession(selectedCountSession === s.id ? null : s.id); }}}
                    >
                      <div className="flex-[2] text-sm font-medium text-white">{s.notes || 'Count Session'}</div>
                      <div className="flex-[1] text-sm text-white/50">{(s as unknown as { branch_name?: string }).branch_name || '—'}</div>
                      <div className="flex-[1]">
                        <StatusBadge status={s.status} colors={{ approved: 'green', pending: 'amber', draft: 'amber' }} />
                      </div>
                      <div className="flex-[1.5] text-xs text-white/35">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                      </div>
                      <div className="w-28 flex items-center justify-end gap-1">
                        {s.status !== 'approved' && (isAdmin || isManager) && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); approveSessionMut.mutate({ id: s.id }); }}
                              className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-green-400 hover:bg-green-950/20"
                              title="Approve"
                              aria-label="Approve session"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); if (confirm('Delete this session?')) deleteSessionMut.mutate(s.id); }}
                              className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-red-400 hover:bg-red-950/20"
                              title="Delete"
                              aria-label="Delete session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Expanded items grid */}
                    {selectedCountSession === s.id && (
                      <div className="px-6 pb-4 bg-white/[0.01]">
                        <div className="flex text-[10px] font-semibold uppercase tracking-wider px-4 py-2 mt-2 rounded-lg text-white/25 bg-white/[0.02]">
                          <div className="flex-[2]">Item</div>
                          <div className="flex-[1] text-right">Expected</div>
                          <div className="flex-[1] text-right">Actual</div>
                          <div className="flex-[1] text-right">Diff</div>
                          <div className="w-20" />
                        </div>
                        {(selectedCountSession ? countItems : []).map(ci => {
                          const diff = ci.actual_quantity - ci.system_quantity;
                          const currentQty = countQtyInput[ci.id] ?? ci.actual_quantity;
                          return (
                            <div key={ci.id} className="flex items-center px-4 py-2 text-xs border-b border-white/[0.03]">
                              <div className="flex-[2] text-white">{ci.item_name}</div>
                              <div className="flex-[1] text-right text-white/50 font-mono">{ci.system_quantity}</div>
                              <div className="flex-[1] text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={currentQty}
                                  onChange={e => setCountQtyInput(prev => ({ ...prev, [ci.id]: Number(e.target.value) }))}
                                  className="w-16 h-7 px-2 rounded-lg text-xs text-center input-cyber"
                                  aria-label={`Actual quantity for ${ci.item_name}`}
                                />
                              </div>
                              <div className={`flex-[1] text-right font-bold font-mono ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-white/30'}`}>
                                {diff > 0 ? '+' : ''}{diff}
                              </div>
                              <div className="w-20 flex justify-end">
                                {currentQty !== ci.actual_quantity && (
                                  <button
                                    onClick={() => updateCountItemMut.mutate({
                                      session_id: ci.session_id,
                                      item_id: ci.item_id,
                                      system_quantity: ci.system_quantity,
                                      actual_quantity: currentQty,
                                    })}
                                    className="h-6 px-2 rounded-lg text-[10px] font-medium text-cyan-400 hover:bg-cyan-950/20 disabled:opacity-50"
                                    disabled={updateCountItemMut.isPending}
                                    aria-label="Update count"
                                  >
                                    Update
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {countItems.length === 0 && (
                          <div className="py-4 text-center text-xs text-white/30">No items loaded</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELIVERY FORM MODAL ─── */}
      {showDeliveryForm && (
        <FixedOverlay
          className="flex items-center justify-center p-4 bg-[var(--app-overlay)] backdrop-blur-sm"
          onClose={() => setShowDeliveryForm(false)}
        >
          <div className="w-full max-w-lg rounded-2xl bg-[var(--app-surface-modal)] border border-white/[0.08] shadow-2xl" role="dialog" aria-modal="true" aria-label={t('delivery.form_title')}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-bold text-white"><Truck className="w-4 h-4 inline mr-2 text-cyan-400" />{t('delivery.form_title')}</h2>
              <button onClick={() => setShowDeliveryForm(false)} className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-white/40" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('delivery.form_to')}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDelForm(f => ({ ...f, to_type: 'warehouse', to_branch_id: '' }))}
                    className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-all ${delForm.to_type === 'warehouse' ? 'bg-amber-500/10 text-amber-400' : 'bg-white/[0.03] text-white/40 hover:text-white/60'}`}
                    aria-label={t('delivery.warehouse')}
                  >
                    <Package className="w-3.5 h-3.5 inline mr-1.5" />{t('delivery.warehouse')}
                  </button>
                  <button
                    onClick={() => setDelForm(f => ({ ...f, to_type: 'branch' }))}
                    className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-all ${delForm.to_type === 'branch' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-white/[0.03] text-white/40 hover:text-white/60'}`}
                    aria-label={t('delivery.branch')}
                  >
                    <Building2 className="w-3.5 h-3.5 inline mr-1.5" />{t('delivery.branch')}
                  </button>
                </div>
              </div>
              {delForm.to_type === 'branch' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('delivery.form_branch')}</label>
                  <select
                    value={delForm.to_branch_id}
                    onChange={e => setDelForm(f => ({ ...f, to_branch_id: e.target.value }))}
                    className="input-cyber cursor-pointer appearance-none"
                    aria-label={t('delivery.form_branch')}
                  >
                    <option value="">{t('delivery.form_branch_placeholder')}</option>
                    {branches.filter(b => b.is_active).map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('delivery.form_item')}</label>
                <select
                  value={delForm.item_id}
                  onChange={e => { const item = allItems.find(i => i.id === e.target.value); setDelForm(f => ({ ...f, item_id: e.target.value, item_name: getItemDisplayName(item) })); }}
                  className="input-cyber cursor-pointer appearance-none"
                  aria-label={t('delivery.form_item')}
                >
                  <option value="">{t('delivery.form_item_placeholder')}</option>
                  {allItems.map(i => (<option key={i.id} value={i.id}>{getItemDisplayName(i)} ({i.category})</option>))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('delivery.form_qty')}</label>
                <input type="number" min="1" value={delForm.quantity || ''} onChange={e => setDelForm(f => ({ ...f, quantity: Number(e.target.value) }))} className="input-cyber" aria-label={t('delivery.form_qty')} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('delivery.form_received_by')}</label>
                <input value={delForm.received_by} onChange={e => setDelForm(f => ({ ...f, received_by: e.target.value }))} placeholder={t('delivery.form_received_by_placeholder')} className="input-cyber" aria-label={t('delivery.form_received_by')} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('delivery.form_notes')}</label>
                <input value={delForm.notes} onChange={e => setDelForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('delivery.form_notes_placeholder')} className="input-cyber" aria-label={t('delivery.form_notes')} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={() => setShowDeliveryForm(false)} className="btn-secondary btn-sm">{t('common.cancel')}</button>
              <button
                onClick={() => createDeliveryMut.mutate()}
                disabled={!delForm.item_name || delForm.quantity <= 0 || (delForm.to_type === 'branch' && !delForm.to_branch_id) || createDeliveryMut.isPending}
                className="btn-primary btn-sm"
                aria-label={t('delivery.form_submit')}
              >
                <Truck className="w-3.5 h-3.5" />{t('delivery.form_submit')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ─── RETURN FORM MODAL ─── */}
      {showReturnForm && (
        <FixedOverlay
          className="flex items-center justify-center p-4 bg-[var(--app-overlay)] backdrop-blur-sm"
          onClose={() => setShowReturnForm(false)}
        >
          <div className="w-full max-w-lg rounded-2xl bg-[var(--app-surface-modal)] border border-white/[0.08] shadow-2xl" role="dialog" aria-modal="true" aria-label={t('returns.form_title')}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-bold text-white"><RotateCcw className="w-4 h-4 inline mr-2 text-cyan-400" />{t('returns.form_title')}</h2>
              <button onClick={() => setShowReturnForm(false)} className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-white/40" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('returns.form_from')}</label>
                <div className="flex gap-2">
                  {(['warehouse', 'branch', 'patient'] as const).map(loc => (
                    <button
                      key={loc}
                      onClick={() => setRetForm(f => ({ ...f, from_location: loc, from_branch_id: '' }))}
                      className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-all ${retForm.from_location === loc ? 'bg-cyan-500/10 text-cyan-400' : 'bg-white/[0.03] text-white/40 hover:text-white/60'}`}
                      aria-label={loc}
                    >
                      {loc === 'warehouse' ? <Package className="w-3.5 h-3.5 inline mr-1" /> : loc === 'branch' ? <Building2 className="w-3.5 h-3.5 inline mr-1" /> : <User className="w-3.5 h-3.5 inline mr-1" />}
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
              {retForm.from_location === 'branch' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('returns.form_branch')}</label>
                  <select
                    value={retForm.from_branch_id}
                    onChange={e => setRetForm(f => ({ ...f, from_branch_id: e.target.value }))}
                    className="input-cyber cursor-pointer appearance-none"
                    aria-label={t('returns.form_branch')}
                  >
                    <option value="">{t('returns.form_branch_placeholder')}</option>
                    {branches.filter(b => b.is_active).map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('returns.form_item')}</label>
                <select
                  value={retForm.item_id}
                  onChange={e => { const item = allItems.find(i => i.id === e.target.value); setRetForm(f => ({ ...f, item_id: e.target.value, item_name: getItemDisplayName(item) })); }}
                  className="input-cyber cursor-pointer appearance-none"
                  aria-label={t('returns.form_item')}
                >
                  <option value="">{t('returns.form_item_placeholder')}</option>
                  {allItems.map(i => (<option key={i.id} value={i.id}>{getItemDisplayName(i)} ({i.category})</option>))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('returns.form_qty')}</label>
                <input type="number" min="1" value={retForm.quantity || ''} onChange={e => setRetForm(f => ({ ...f, quantity: Number(e.target.value) }))} className="input-cyber" aria-label={t('returns.form_qty')} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('returns.form_reason')}</label>
                <input value={retForm.reason} onChange={e => setRetForm(f => ({ ...f, reason: e.target.value }))} placeholder={t('returns.form_reason_placeholder')} className="input-cyber" aria-label={t('returns.form_reason')} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('returns.form_notes')}</label>
                <input value={retForm.notes} onChange={e => setRetForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('returns.form_notes_placeholder')} className="input-cyber" aria-label={t('returns.form_notes')} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={() => setShowReturnForm(false)} className="btn-secondary btn-sm">{t('common.cancel')}</button>
              <button
                onClick={() => createReturnMut.mutate()}
                disabled={!retForm.item_name || retForm.quantity <= 0 || (retForm.from_location === 'branch' && !retForm.from_branch_id) || createReturnMut.isPending}
                className="btn-primary btn-sm"
                aria-label={t('returns.form_submit')}
              >
                <RotateCcw className="w-3.5 h-3.5" />{t('returns.form_submit')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ─── CREATE/EDIT IMPLANT/ABUTMENT MODAL ─── */}
      {showModal && (
        <FixedOverlay
          className="flex items-center justify-center p-4 bg-[var(--app-overlay)] backdrop-blur-sm"
          onClose={() => { setShowModal(false); resetModal(); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--app-surface-modal)] border border-white/[0.08] shadow-2xl" role="dialog" aria-modal="true" aria-label={editId ? (modalMode === 'implant' ? t('inventory.modal_edit_implant') : t('inventory.modal_edit_abutment')) : (modalMode === 'implant' ? t('inventory.modal_add_implant') : t('inventory.modal_add_abutment'))}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-bold text-white">
                {editId
                  ? (modalMode === 'implant' ? t('inventory.modal_edit_implant') : t('inventory.modal_edit_abutment'))
                  : (modalMode === 'implant' ? t('inventory.modal_add_implant') : t('inventory.modal_add_abutment'))}
              </h2>
              <button onClick={() => { setShowModal(false); resetModal(); }} className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-white/40" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              {modalMode === 'implant' ? (
                <>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('inventory.modal_brand')}</label>
                    {!customBrand ? (
                      <div className="flex gap-2">
                        <select
                          value={modalForm.brand}
                          onChange={e => { const v = e.target.value; if (v === '__new__') setCustomBrand(true); else setModalForm(f => ({ ...f, brand: v })); }}
                          className="input-cyber cursor-pointer appearance-none flex-1"
                          aria-label={t('inventory.modal_brand')}
                        >
                          <option value="">{t('inventory.modal_select_brand')}</option>
                          {[...new Set(implants.map(i => i.brand))].sort().map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                          <option value="__new__" className="text-cyan-400">{t('inventory.modal_new_brand')}</option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          value={modalForm.brand}
                          onChange={e => setModalForm(f => ({ ...f, brand: e.target.value }))}
                          placeholder={t('inventory.modal_type_brand')}
                          className="input-cyber flex-1"
                          autoFocus
                          aria-label="Custom brand"
                        />
                        <button onClick={() => { setCustomBrand(false); setModalForm(f => ({ ...f, brand: '' })); }} className="btn-ghost btn-sm" aria-label={t('inventory.modal_back')}>{t('inventory.modal_back')}</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('inventory.modal_size')}</label>
                    {!customSize ? (
                      <div className="flex gap-2">
                        <select
                          value={modalForm.size}
                          onChange={e => { const v = e.target.value; if (v === '__new__') setCustomSize(true); else setModalForm(f => ({ ...f, size: v })); }}
                          disabled={!modalForm.brand}
                          className="input-cyber cursor-pointer appearance-none flex-1 disabled:opacity-40"
                          aria-label={t('inventory.modal_size')}
                        >
                          <option value="">{modalForm.brand ? t('inventory.modal_select_size') : t('inventory.modal_select_brand_first')}</option>
                          {implants.filter(i => i.brand === modalForm.brand).map(i => (
                            <option key={i.id} value={i.size}>{i.size}</option>
                          ))}
                          {modalForm.brand && <option value="__new__" className="text-cyan-400">{t('inventory.modal_new_size')}</option>}
                        </select>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          value={modalForm.size}
                          onChange={e => setModalForm(f => ({ ...f, size: e.target.value }))}
                          placeholder="e.g. 4.3 x 10mm"
                          className="input-cyber flex-1"
                          autoFocus
                          aria-label="Custom size"
                        />
                        <button onClick={() => { setCustomSize(false); setModalForm(f => ({ ...f, size: '' })); }} className="btn-ghost btn-sm" aria-label={t('inventory.modal_back')}>{t('inventory.modal_back')}</button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('inventory.modal_type')}</label>
                  {!customType ? (
                    <div className="flex gap-2">
                      <select
                        value={modalForm.type}
                        onChange={e => { const v = e.target.value; if (v === '__new__') setCustomType(true); else setModalForm(f => ({ ...f, type: v })); }}
                        className="input-cyber cursor-pointer appearance-none flex-1"
                        aria-label={t('inventory.modal_type')}
                      >
                        <option value="">{t('inventory.modal_select_type')}</option>
                        {abutments.map(a => (
                          <option key={a.id} value={a.type}>{a.type}</option>
                        ))}
                        <option value="__new__" className="text-cyan-400">{t('inventory.modal_new_type')}</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={modalForm.type}
                        onChange={e => setModalForm(f => ({ ...f, type: e.target.value }))}
                        placeholder={t('inventory.modal_type_new_type')}
                        className="input-cyber flex-1"
                        autoFocus
                        aria-label="Custom type"
                      />
                      <button onClick={() => { setCustomType(false); setModalForm(f => ({ ...f, type: '' })); }} className="btn-ghost btn-sm" aria-label={t('inventory.modal_back')}>{t('inventory.modal_back')}</button>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('inventory.modal_quantity')}</label>
                <input type="number" min="0" value={modalForm.quantity} onChange={e => setModalForm(f => ({ ...f, quantity: Number(e.target.value) }))} className="input-cyber" aria-label={t('inventory.modal_quantity')} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={() => { setShowModal(false); resetModal(); }} className="btn-secondary btn-sm">{t('inventory.modal_cancel')}</button>
              <button
                onClick={() => {
                  if (editId) {
                    if (modalMode === 'implant') { updateImplantMut.mutate(); }
                    else { updateAbutMut.mutate(); }
                  } else {
                    if (modalMode === 'implant') { upsertImplantMut.mutate(); }
                    else { upsertAbutMut.mutate(); }
                  }
                }}
                disabled={upsertImplantMut.isPending || updateImplantMut.isPending || upsertAbutMut.isPending || updateAbutMut.isPending}
                className="btn-primary btn-sm"
                aria-label={editId ? t('inventory.modal_save') : t('inventory.modal_add')}
              >
                {editId ? t('inventory.modal_save') : t('inventory.modal_add')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ─── STOCK ADJUST MODAL (old tables) ─── */}
      {adjustModal && (
        <FixedOverlay
          className="flex items-center justify-center p-4 bg-[var(--app-overlay)] backdrop-blur-sm"
          onClose={() => { setAdjustModal(null); setAdjustQty(0); setAdjustNotes(''); }}
        >
          <div className="w-full max-w-sm rounded-2xl p-6 bg-[var(--app-surface-modal)] border border-white/[0.08] shadow-2xl" role="dialog" aria-modal="true" aria-label={t('inventory.modal_adjust_title')}>
            <h3 className="text-sm font-bold text-white mb-1">{t('inventory.modal_adjust_title')}</h3>
            <p className="text-xs mb-4 text-white/40">{adjustModal.label}</p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('inventory.modal_adjust_qty')}</label>
                <input type="number" value={adjustQty} onChange={e => setAdjustQty(Number(e.target.value))} placeholder={t('inventory.modal_adjust_placeholder')} className="input-cyber" aria-label={t('inventory.modal_adjust_qty')} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('inventory.modal_adjust_notes')}</label>
                <input value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)} placeholder={t('inventory.modal_adjust_reason')} className="input-cyber" aria-label={t('inventory.modal_adjust_notes')} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => { setAdjustModal(null); setAdjustQty(0); setAdjustNotes(''); }} className="btn-secondary btn-sm">{t('inventory.modal_cancel')}</button>
              <button
                onClick={() => adjustMut.mutate({})}
                disabled={adjustQty === 0 || adjustMut.isPending}
                className="btn-primary btn-sm"
                aria-label={t('inventory.modal_apply')}
              >
                {adjustMut.isPending ? t('inventory.modal_adjusting') : t('inventory.modal_apply')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ─── ITEM ACTION MODAL (issue/return/adjust for new items) ─── */}
      {itemActionModal && (
        <FixedOverlay
          className="flex items-center justify-center p-4 bg-[var(--app-overlay)] backdrop-blur-sm"
          onClose={() => { setItemActionModal(null); setActionQty(0); setActionNotes(''); }}
        >
          <div className="w-full max-w-sm rounded-2xl p-6 bg-[var(--app-surface-modal)] border border-white/[0.08] shadow-2xl" role="dialog" aria-modal="true" aria-label={itemActionModal.action === 'issue' ? t('inventory.modal_issue_title') : itemActionModal.action === 'return' ? t('inventory.modal_return_title') : t('inventory.modal_adjust_item_title')}>
            <h3 className="text-sm font-bold text-white mb-1">
              {itemActionModal.action === 'issue' ? t('inventory.modal_issue_title') : itemActionModal.action === 'return' ? t('inventory.modal_return_title') : t('inventory.modal_adjust_item_title')}
            </h3>
            <p className="text-xs mb-4 text-white/40">
              {itemActionModal.item.name || itemActionModal.item.subcategory}
              {itemActionModal.item.brand && ` - ${itemActionModal.item.brand}`}
              {itemActionModal.item.size && ` ${itemActionModal.item.size}`}
              <span className="ml-2">{t('inventory.modal_item_avail', { count: itemActionModal.item.quantity - itemActionModal.item.reserved })}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">
                  {itemActionModal.action === 'adjust' ? t('inventory.modal_item_qty_change') : t('inventory.modal_item_qty')}
                </label>
                <input type="number" min="1" value={actionQty} onChange={e => setActionQty(Number(e.target.value))}
                  placeholder={itemActionModal.action === 'adjust' ? t('inventory.modal_item_placeholder_pn') : t('inventory.modal_item_placeholder_qty')} className="input-cyber" aria-label="Quantity" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">{t('inventory.col_notes')}</label>
                <input value={actionNotes} onChange={e => setActionNotes(e.target.value)} placeholder={t('inventory.modal_item_notes')} className="input-cyber" aria-label="Notes" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => { setItemActionModal(null); setActionQty(0); setActionNotes(''); }} className="btn-secondary btn-sm">{t('inventory.modal_cancel')}</button>
              <button
                onClick={() => {
                    if (itemActionModal.action === 'issue') issueMut.mutate({});
                    else if (itemActionModal.action === 'return') returnMut.mutate({});
                    else adjustItemMut.mutate({});
                  }}
                disabled={actionQty <= 0 || issueMut.isPending || returnMut.isPending || adjustItemMut.isPending}
                className="btn-primary btn-sm"
                aria-label={itemActionModal.action === 'issue' ? t('inventory.modal_issue') : itemActionModal.action === 'return' ? t('inventory.modal_return') : t('inventory.modal_adjust')}
              >
                {itemActionModal.action === 'issue' ? t('inventory.modal_issue') : itemActionModal.action === 'return' ? t('inventory.modal_return') : t('inventory.modal_adjust')}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ─── CREATE COUNT SESSION MODAL ─── */}
      {showCountForm && (
        <FixedOverlay
          className="flex items-center justify-center p-4 bg-[var(--app-overlay)] backdrop-blur-sm"
          onClose={() => setShowCountForm(false)}
        >
          <div className="w-full max-w-md rounded-2xl p-6 bg-[var(--app-surface-modal)] border border-white/[0.08] shadow-2xl" role="dialog" aria-modal="true" aria-label="New Inventory Count">
            <h3 className="text-base font-bold text-white mb-1"><ClipboardList className="w-4 h-4 inline mr-2 text-cyan-400" />New Inventory Count</h3>
            <p className="text-xs mb-4 text-white/40">Creates a snapshot of all current inventory quantities. You can adjust actual counts after creation.</p>
            <div className="space-y-4 mb-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">Session Name</label>
                <input value={countSessionName} onChange={e => setCountSessionName(e.target.value)}
                  placeholder="e.g. Monthly Count June 2026" className="input-cyber" aria-label="Session Name" />
              </div>
              {!userBranchId && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">Branch</label>
                  <select value={countBranchId} onChange={e => setCountBranchId(e.target.value)}
                    className="input-cyber cursor-pointer" aria-label="Branch">
                    <option value="">Select Branch</option>
                    {allBranches.filter(b => b.is_active).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowCountForm(false)} className="btn-secondary btn-sm">Cancel</button>
              <button
                onClick={() => createCountSessionMut.mutate()}
                disabled={!countSessionName.trim() || !countBranchId || createCountSessionMut.isPending}
                className="btn-primary btn-sm"
                aria-label="Create Session"
              >
                {createCountSessionMut.isPending ? 'Creating...' : 'Create Session'}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ─── STOCK REQUEST MODAL ─── */}
      {showRequestModal && (
        <FixedOverlay
          className="flex items-center justify-center p-4 bg-[var(--app-overlay)] backdrop-blur-sm"
          onClose={() => { setShowRequestModal(false); setRequestForm({ from_branch_id: '', item_id: '', item_name: '', item_category: '', quantity: 0, notes: '' }); setRequestCategory(''); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--app-surface-modal)] border border-white/[0.08] shadow-2xl" role="dialog" aria-modal="true" aria-label="New Request">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-bold text-white"><Send className="w-4 h-4 inline mr-2 text-cyan-400" />New Request</h2>
              <button onClick={() => { setShowRequestModal(false); setRequestForm({ from_branch_id: '', item_id: '', item_name: '', item_category: '', quantity: 0, notes: '' }); setRequestCategory(''); }}
                className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-white/40" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">Category</label>
                <select value={requestCategory} onChange={e => { setRequestCategory(e.target.value); setRequestForm(f => ({ ...f, item_id: '', item_name: '', item_category: '', from_branch_id: '' })); }}
                  className="input-cyber cursor-pointer appearance-none" aria-label="Category">
                  <option value="">All Categories</option>
                  <option value="implant">Implants</option>
                  <option value="abutment">Abutments</option>
                  <option value="prosthetic">Prosthetic</option>
                  <option value="material">Materials</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">Item</label>
                <select value={requestForm.item_id} onChange={e => {
                  const item = productCatalog.find(i => i.id === e.target.value);
                  setRequestForm(f => ({
                    ...f, item_id: e.target.value, from_branch_id: '',
                    item_name: getItemDisplayName(item),
                    item_category: item?.category || '',
                  }));
                }} className="input-cyber cursor-pointer appearance-none" aria-label="Item">
                  <option value="">Select item...</option>
                  {productCatalog.filter(i => !requestCategory || i.category === requestCategory).map(i => {
                    const label = `${i.category} - ${getItemDisplayName(i)}`;
                    return (
                      <option key={i.id} value={i.id}>{label}</option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">Source Branch</label>
                <select value={requestForm.from_branch_id} onChange={e => setRequestForm(f => ({ ...f, from_branch_id: e.target.value }))}
                  className="input-cyber cursor-pointer appearance-none" aria-label="Source Branch">
                  <option value="">
                    {requestForm.item_id ? 'Select source branch...' : 'Select an item first'}
                  </option>
                  {availableBranches.map(b => (
                    <option key={b.branch_id} value={b.branch_id}>
                      {b.branch_name} (Stock: {b.qty})
                    </option>
                  ))}
                </select>
                {requestForm.item_id && availableBranches.length === 0 && (
                  <p className="text-xs mt-1 text-red-400">No branches have this item in stock</p>
                )}
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">Quantity</label>
                <input type="number" min="1" value={requestForm.quantity || ''} onChange={e => setRequestForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                  className="input-cyber" aria-label="Quantity" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">Notes</label>
                <textarea value={requestForm.notes} onChange={e => setRequestForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="input-cyber h-16 pt-2 resize-none" placeholder="Optional notes" aria-label="Notes" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={() => { setShowRequestModal(false); setRequestForm({ from_branch_id: '', item_id: '', item_name: '', item_category: '', quantity: 0, notes: '' }); setRequestCategory(''); }}
                className="btn-secondary btn-sm">Cancel</button>
              <button
                onClick={() => createRequestMut.mutate()}
                disabled={!requestForm.from_branch_id || !requestForm.item_name || requestForm.quantity <= 0 || createRequestMut.isPending}
                className="btn-primary btn-sm"
                aria-label="Send Request"
              >
                {createRequestMut.isPending ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

      {/* ─── ADD STOCK MODAL ─── */}
      {showAddStock && (
        <FixedOverlay
          className="flex items-center justify-center p-4 bg-[var(--app-overlay)] backdrop-blur-sm"
          onClose={() => setShowAddStock(false)}
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--app-surface-modal)] border border-white/[0.08] shadow-2xl" role="dialog" aria-modal="true" aria-label="Add Stock to Branch">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-bold text-white"><Plus className="w-4 h-4 inline mr-2 text-cyan-400" />Add Stock to Branch</h2>
              <button onClick={() => setShowAddStock(false)} className="btn-ghost btn-xs !w-8 !h-8 !p-0 text-white/40" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">Category</label>
                <select value={addStockCategory} onChange={e => { setAddStockCategory(e.target.value); setAddStockForm(f => ({ ...f, add_item_id: '', add_category: '' })); }}
                  className="input-cyber cursor-pointer appearance-none" aria-label="Category">
                  <option value="">All Categories</option>
                  <option value="implant">Implants</option>
                  <option value="abutment">Abutments</option>
                  <option value="prosthetic">Prosthetic</option>
                  <option value="material">Materials</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">Item</label>
                <select value={addStockForm.add_item_id} onChange={e => {
                  const item = productCatalog.find(i => i.id === e.target.value);
                  setAddStockForm(f => ({ ...f, add_item_id: e.target.value, add_category: item?.category || '' }));
                }} className="input-cyber cursor-pointer appearance-none" aria-label="Item">
                  <option value="">Select item...</option>
                  {productCatalog.filter(i => !addStockCategory || i.category === addStockCategory).map(i => (
                    <option key={i.id} value={i.id}>
                      {i.category} - {getItemDisplayName(i)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">Target Branch</label>
                <select value={addStockForm.add_branch_id} onChange={e => setAddStockForm(f => ({ ...f, add_branch_id: e.target.value }))}
                  className="input-cyber cursor-pointer appearance-none" aria-label="Target Branch">
                  <option value="">Select branch...</option>
                  {allBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">Quantity</label>
                <input type="number" min="1" value={addStockForm.add_quantity || ''} onChange={e => setAddStockForm(f => ({ ...f, add_quantity: Number(e.target.value) }))}
                  className="input-cyber" aria-label="Quantity" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5 text-white/30">Notes</label>
                <textarea value={addStockForm.add_notes} onChange={e => setAddStockForm(f => ({ ...f, add_notes: e.target.value }))}
                  rows={2} className="input-cyber h-16 pt-2 resize-none" placeholder="Optional notes" aria-label="Notes" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={() => setShowAddStock(false)} className="btn-secondary btn-sm">Cancel</button>
              <button
                onClick={() => addStockMut.mutate({})}
                disabled={!addStockForm.add_item_id || !addStockForm.add_branch_id || addStockForm.add_quantity <= 0 || addStockMut.isPending}
                className={`btn-sm ${addStockMut.isPending ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-gradient-to-br from-[#00E5A8] to-[#00C99D] text-[#050B14] font-bold hover:shadow-lg hover:shadow-green-500/20'} rounded-xl transition-all active:scale-[0.98] disabled:opacity-50`}
                aria-label="Add Stock"
              >
                {addStockMut.isPending ? 'Adding...' : 'Add Stock'}
              </button>
            </div>
          </div>
        </FixedOverlay>
      )}

    </div>
  );
}
