import { useState, useEffect } from 'react';
import { Package, ChevronDown, ChevronUp, ExternalLink, Clock, CheckCircle2, Truck, BoxIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { Order } from '../types';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  processing: 'Đang xử lý',
  shipped: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-violet-100 text-violet-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

interface TrackingData {
  timeline: { status: string; label: string; time: string | null; done: boolean }[];
  tracking_url: string | null;
  tracking_code: string | null;
  shipping_provider: string | null;
}

export const OrderHistory = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [trackingData, setTrackingData] = useState<Record<number, TrackingData>>({});
  const [orderItems, setOrderItems] = useState<Record<number, any[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<Record<number, boolean>>({});
  const { authHeaders } = useAuth();

  useEffect(() => {
    fetch('/api/orders/my', { headers: authHeaders() })
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => { setOrders(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Polling: cập nhật đơn hàng mỗi 30 giây
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/orders/my', { headers: authHeaders() })
        .then(res => { if (!res.ok) throw new Error(); return res.json(); })
        .then(data => {
          setOrders(data);
          // Re-fetch tracking cho đơn đang mở
          if (expandedId) {
            fetch(`/api/orders/${expandedId}/tracking`, { headers: authHeaders() })
              .then(res => res.json())
              .then(t => setTrackingData(prev => ({ ...prev, [expandedId]: t })))
              .catch(() => {});
          }
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [expandedId]);

  const toggleExpand = async (orderId: number) => {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(orderId);
    setLoadingDetail(prev => ({ ...prev, [orderId]: true }));

    // Fetch tracking + items
    const headers = authHeaders();
    const promises: Promise<void>[] = [];
    if (!trackingData[orderId]) {
      promises.push(
        fetch(`/api/orders/${orderId}/tracking`, { headers })
          .then(res => res.json())
          .then(t => setTrackingData(prev => ({ ...prev, [orderId]: t })))
          .catch(() => {})
      );
    }
    if (!orderItems[orderId]) {
      promises.push(
        fetch(`/api/orders/${orderId}/items`, { headers })
          .then(res => res.json())
          .then(items => setOrderItems(prev => ({ ...prev, [orderId]: items })))
          .catch(() => {})
      );
    }
    Promise.all(promises).finally(() => setLoadingDetail(prev => ({ ...prev, [orderId]: false })));
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-24 flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-2xl animate-shimmer" />
      <div className="w-48 h-4 rounded-full animate-shimmer" />
    </div>
  );

  if (orders.length === 0) return (
    <div className="max-w-3xl mx-auto px-4 py-24 text-center">
      <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
        <Package className="w-10 h-10 text-slate-300" />
      </div>
      <p className="text-slate-500 font-medium">Bạn chưa có đơn hàng nào</p>
      <p className="text-slate-400 text-sm mt-1">Hãy mua sắm và quay lại đây nhé!</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-900">Đơn hàng của tôi</h2>
        <p className="text-slate-500 text-sm mt-1">Theo dõi trạng thái và lịch sử đơn hàng</p>
      </div>
      <div className="space-y-4">
        {orders.map((order, idx) => {
          const isExpanded = expandedId === order.id;
          const tracking = trackingData[order.id];
          const items = orderItems[order.id];

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm"
            >
              {/* Header */}
              <button
                onClick={() => toggleExpand(order.id)}
                className="w-full px-6 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-left">
                    <span className="font-mono text-xs text-slate-500">#ORD-{order.id}</span>
                    <p className="font-semibold text-slate-900 text-sm mt-0.5">{order.total_amount.toLocaleString('vi-VN')}đ</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {order.tracking_code && (
                    <span className="hidden sm:inline font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                      {order.tracking_code}
                    </span>
                  )}
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${STATUS_COLORS[order.status] || 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {/* Expanded content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 border-t border-slate-100 pt-5 space-y-6">
                      {loadingDetail[order.id] ? (
                        <div className="flex items-center justify-center py-8 gap-3">
                          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm text-slate-400">Đang tải...</span>
                        </div>
                      ) : (<>
                      {/* Timeline */}
                      {tracking?.timeline && (
                        <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Theo dõi đơn hàng</h4>
                          <div className="relative">
                            {tracking.timeline.map((step, i) => {
                              const icons: Record<string, React.ReactNode> = {
                                pending: <Clock className="w-4 h-4" />,
                                processing: <BoxIcon className="w-4 h-4" />,
                                shipped: <Truck className="w-4 h-4" />,
                                delivered: <CheckCircle2 className="w-4 h-4" />,
                              };
                              return (
                                <div key={step.status} className="flex gap-4 relative">
                                  {/* Vertical line */}
                                  {i < tracking.timeline.length - 1 && (
                                    <div className={`absolute left-[15px] top-8 w-0.5 h-[calc(100%-8px)] ${step.done ? 'bg-indigo-300' : 'bg-slate-200'}`} />
                                  )}
                                  {/* Icon */}
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                                    step.done ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    {icons[step.status] || <Clock className="w-4 h-4" />}
                                  </div>
                                  {/* Text */}
                                  <div className="pb-6">
                                    <p className={`text-sm font-semibold ${step.done ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p>
                                    {step.time && (
                                      <p className="text-xs text-slate-400 mt-0.5">{new Date(step.time).toLocaleString('vi-VN')}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {tracking.tracking_url && (
                            <a
                              href={tracking.tracking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 mt-2"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Theo dõi trên {tracking.shipping_provider}
                            </a>
                          )}
                          {tracking.shipping_provider === 'DEMO' && tracking.tracking_code && (
                            <p className="text-[11px] text-slate-400 mt-2 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                              🚀 Chế độ Demo — trạng thái tự chuyển: Đang xử lý → 30s → Đang giao → 60s → Đã giao
                            </p>
                          )}
                        </div>
                      )}

                      {/* Order items */}
                      {items && items.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Sản phẩm</h4>
                          <div className="space-y-2">
                            {items.map((item: any) => (
                              <div key={item.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl">
                                {item.image_url && (
                                  <img src={item.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-white border border-slate-100" referrerPolicy="no-referrer" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-900 truncate">{item.product_name}</p>
                                  <p className="text-[11px] text-slate-400">SL: {item.quantity} × {item.price.toLocaleString('vi-VN')}đ</p>
                                </div>
                                <p className="text-xs font-bold text-slate-700">{(item.quantity * item.price).toLocaleString('vi-VN')}đ</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Info */}
                      <div className="text-xs text-slate-400 flex gap-4">
                        <span>Ngày đặt: {new Date(order.created_at).toLocaleDateString('vi-VN')}</span>
                        {order.tracking_code && <span>Mã vận đơn: <span className="font-mono text-slate-600">{order.tracking_code}</span></span>}
                      </div>
                      </>)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
