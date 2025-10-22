import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

const Announcements = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [announcementType, setAnnouncementType] = useState('general');

  useEffect(() => {
    if (!user || !isAdmin) {
      navigate('/');
      return;
    }
    loadAnnouncements();
  }, [user, isAdmin, navigate]);

  const loadAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setAnnouncements(data);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('announcements')
      .insert({
        title,
        content,
        announcement_type: announcementType,
        created_by: user?.id
      });

    if (error) {
      toast.error('Failed to create announcement');
    } else {
      toast.success('Announcement created successfully');
      setTitle('');
      setContent('');
      setAnnouncementType('general');
      loadAnnouncements();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('announcements')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete announcement');
    } else {
      toast.success('Announcement deleted');
      loadAnnouncements();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <Button
          onClick={() => navigate('/admin')}
          variant="ghost"
          className="mb-4 text-white hover:bg-white/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Admin
        </Button>

        <Card className="p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Create New Announcement</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement title"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Content</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Announcement content"
                rows={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <Select value={announcementType} onValueChange={setAnnouncementType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="quiz_start">Quiz Start</SelectItem>
                  <SelectItem value="winner">Winner Announcement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Create Announcement
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">All Announcements</h2>
          
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className={`p-4 ${!announcement.is_active ? 'opacity-50' : ''}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold">{announcement.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{announcement.content}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs bg-secondary/20 px-2 py-1 rounded">
                        {announcement.announcement_type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(announcement.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {announcement.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(announcement.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Announcements;
