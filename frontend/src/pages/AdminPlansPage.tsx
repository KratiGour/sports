import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { plansApi } from "../lib/api";

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    monthly_price: "",
    yearly_price: "",
    features: ""
  });

  const fetchPlans = () => {
    plansApi.list().then((res: any) => {
      setPlans(res.data);
    });
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleDelete = async (id: number) => {
    await plansApi.delete(id);
    fetchPlans();
  };

  const handleCreate = async () => {
    await plansApi.create({
      name: form.name,
      monthly_price: Number(form.monthly_price),
      yearly_price: Number(form.yearly_price),
      features: form.features
    });

    setForm({
      name: "",
      monthly_price: "",
      yearly_price: "",
      features: ""
    });

    fetchPlans();
  };

  return (
    <div className="text-white">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 mb-8 border border-white/20"
      >
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-crown text-yellow-400"></i>
          Subscription Plans
        </h1>
        <p className="text-white/70 mt-2 text-sm">
          Manage subscription tiers and pricing
        </p>
      </motion.div>

      {/* Create Plan Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-3xl p-6 mb-8 border border-white/20"
      >
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-plus-circle text-green-400"></i>
          Create New Plan
        </h3>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <input
            placeholder="Plan name (e.g., Gold)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
          />

          <input
            type="number"
            placeholder="Monthly price"
            value={form.monthly_price}
            onChange={(e) => setForm({ ...form, monthly_price: e.target.value })}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
          />

          <input
            type="number"
            placeholder="Yearly price"
            value={form.yearly_price}
            onChange={(e) => setForm({ ...form, yearly_price: e.target.value })}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
          />

          <input
            placeholder="Features (comma-separated)"
            value={form.features}
            onChange={(e) => setForm({ ...form, features: e.target.value })}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>

        <button
          onClick={handleCreate}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all duration-300 font-semibold flex items-center gap-2"
        >
          <i className="fas fa-plus"></i>
          Create Plan
        </button>
      </motion.div>

      {/* Plans List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass rounded-3xl p-6 border border-white/20 hover:border-white/30 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold gradient-text">{plan.name}</h3>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center">
                <i className="fas fa-crown text-white"></i>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Monthly</span>
                <span className="text-2xl font-bold text-green-400">₹{plan.monthly_price}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Yearly</span>
                <span className="text-2xl font-bold text-blue-400">₹{plan.yearly_price}</span>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-white/60 mb-2">Features:</p>
              <p className="text-sm">{plan.features}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  const newPrice = prompt("New monthly price");
                  if (newPrice) {
                    await plansApi.update(plan.id, {
                      name: plan.name,
                      monthly_price: Number(newPrice),
                      yearly_price: plan.yearly_price,
                      features: plan.features
                    });
                    fetchPlans();
                  }
                }}
                className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 transition-all duration-300 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <i className="fas fa-edit"></i>
                Update
              </button>

              <button
                onClick={() => handleDelete(plan.id)}
                className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-300 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <i className="fas fa-trash"></i>
                Delete
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12 glass rounded-3xl border border-white/20">
          <i className="fas fa-inbox text-4xl text-white/20 mb-4"></i>
          <p className="text-white/60">No plans created yet</p>
          <p className="text-sm text-white/40 mt-1">Create your first subscription plan above</p>
        </div>
      )}
    </div>
  );
}