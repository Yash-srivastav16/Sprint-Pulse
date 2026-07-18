import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      className={cn(
        "relative isolate grid min-h-[260px] place-items-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white/72 px-5 py-12 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.045]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-400/80 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,169,154,0.07),transparent_42%,rgba(132,98,232,0.08))] dark:bg-[linear-gradient(135deg,rgba(16,169,154,0.09),transparent_42%,rgba(132,98,232,0.12))]" />
      <div className="relative z-10 flex max-w-md flex-col items-center">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.08, type: "spring", stiffness: 210, damping: 18 }}
        className="mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-primary-500/20 bg-primary-500/10 text-primary-700 shadow-[0_18px_45px_rgba(16,169,154,0.16)] dark:text-primary-100"
      >
        <Icon className="h-7 w-7" />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="m-0 text-xl font-black tracking-normal text-slate-950 dark:text-white"
      >
        {title}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="m-0 mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300"
      >
        {description}
      </motion.p>

      {action && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <Button className="min-h-11 rounded-xl bg-gradient-to-r from-primary-500 to-info-500 px-5 font-black text-white shadow-[0_16px_40px_rgba(16,169,154,0.22)] transition hover:-translate-y-0.5" onClick={action.onClick}>
            {action.label}
          </Button>
        </motion.div>
      )}
      </div>
    </motion.div>
  );
}
