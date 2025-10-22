import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, X } from 'lucide-react';
import { Card } from '@/components/ui/card';

export const AnnouncementsBanner = () => {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    loadAnnouncements();
    
    const channel = supabase
      .channel('announcements-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements'
        },
        () => loadAnnouncements()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (data) setAnnouncements(data);
  };

  const handleDismiss = (id: string) => {
    setDismissed([...dismissed, id]);
  };

  const visibleAnnouncements = announcements.filter(a => !dismissed.includes(a.id));

  if (visibleAnnouncements.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visibleAnnouncements.map((announcement) => (
        <Card key={announcement.id} className="bg-secondary/10 border-secondary/30 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1">
              <Bell className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm">{announcement.title}</h4>
                <p className="text-sm text-muted-foreground">{announcement.content}</p>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(announcement.id)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
};
