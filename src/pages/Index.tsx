import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Trophy, Zap, IndianRupee, Clock, Award, Users, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';

const Index = () => {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (data) setAnnouncements(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/70">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center space-y-8 mb-16">
          <div className="flex items-center justify-center gap-3 animate-slide-up">
            <Trophy className="h-16 w-16 text-secondary animate-pulse-glow" />
            <h1 className="text-5xl md:text-6xl font-bold text-white">
              ₹1 Daily Quiz
            </h1>
          </div>
          
          <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto animate-slide-up">
            Test your knowledge across <span className="text-secondary font-bold">General Knowledge, Sports, Current Affairs, History, Movies & More</span>
          </p>

          {announcements.length > 0 && (
            <div className="mb-6 animate-slide-up">
              <Card className="bg-secondary/20 border-secondary/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="h-5 w-5 text-secondary" />
                  <h3 className="font-semibold text-white">Latest Announcements</h3>
                </div>
                <div className="space-y-2">
                  {announcements.map((announcement) => (
                    <div key={announcement.id} className="text-white/80 text-sm">
                      • {announcement.title}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up">
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="bg-gradient-gold text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all"
            >
              <Zap className="mr-2 h-5 w-5" />
              Sign Up / Register
            </Button>
            <Button
              onClick={() => navigate('/guest-register')}
              size="lg"
              variant="outline"
              className="bg-white/10 text-white border-white/30 hover:bg-white/20 text-lg px-8 py-6"
            >
              <Users className="mr-2 h-5 w-5" />
              Continue as Guest
            </Button>
          </div>
          
          <p className="text-white/70 text-sm mt-4 animate-slide-up">
            <strong>Registered users</strong> get email/SMS notifications for quiz starts, winners & announcements!
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center hover:bg-white/20 transition-all">
            <IndianRupee className="h-12 w-12 text-secondary mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Just ₹1 Entry</h3>
            <p className="text-white/80">Pay only ₹1 to participate in daily quiz</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center hover:bg-white/20 transition-all">
            <Award className="h-12 w-12 text-secondary mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Win Big Prizes</h3>
            <p className="text-white/80">Top scorers win cash prizes daily</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 text-center hover:bg-white/20 transition-all">
            <Clock className="h-12 w-12 text-secondary mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Results at 9 PM</h3>
            <p className="text-white/80">Daily results published at 9 PM IST</p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
          <h2 className="text-3xl font-bold text-white text-center mb-8">How It Works</h2>
          
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-secondary/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h4 className="font-semibold text-white mb-2">Register/Guest</h4>
              <p className="text-white/70 text-sm">Sign up or continue as guest</p>
            </div>

            <div className="text-center">
              <div className="bg-secondary/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h4 className="font-semibold text-white mb-2">Pay ₹1</h4>
              <p className="text-white/70 text-sm">Quick UPI payment via Razorpay</p>
            </div>

            <div className="text-center">
              <div className="bg-secondary/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h4 className="font-semibold text-white mb-2">Take Quiz</h4>
              <p className="text-white/70 text-sm">Answer questions correctly</p>
            </div>

            <div className="text-center">
              <div className="bg-secondary/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">4</span>
              </div>
              <h4 className="font-semibold text-white mb-2">Win Prizes</h4>
              <p className="text-white/70 text-sm">Top scorers win cash!</p>
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <p className="text-white/70 mb-4">
            Join thousands of quiz enthusiasts competing daily
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="bg-white text-primary hover:bg-white/90 text-lg px-8 py-6"
            >
              Sign Up to Start
            </Button>
            <Button
              onClick={() => navigate('/guest-register')}
              size="lg"
              variant="outline"
              className="bg-white/10 text-white border-white/30 hover:bg-white/20 text-lg px-8 py-6"
            >
              Play as Guest
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
