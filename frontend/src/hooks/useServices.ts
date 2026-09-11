import { useEffect, useState } from 'react';
import { api } from '../api/client';

export interface Service {
  key: string;
  title: string;
  subtitle: string;
  url: string;
  icon_key: string;
  category: string; 
  task_id: string | null;
  roles: string[];
  sort_order: number;
  is_visible: boolean;
  open_new_tab: boolean;
  extra: Record<string, string>;
}

export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    api.get<{ services: Service[] }>('/api/integrations/services')
      .then((r) => setServices(r.services ?? []))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  return { services, loading, reload };
}
