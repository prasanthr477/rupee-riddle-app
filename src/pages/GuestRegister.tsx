import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useGuest } from '@/contexts/GuestContext';
import { useToast } from '@/hooks/use-toast';
import { HomeButton } from '@/components/HomeButton';
import { UserCircle } from 'lucide-react';

const GuestRegister = () => {
  const navigate = useNavigate();
  const { setGuestDetails } = useGuest();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.phone) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(formData.phone)) {
      toast({
        title: "Invalid Phone",
        description: "Please enter a valid 10-digit phone number",
        variant: "destructive"
      });
      return;
    }

    setGuestDetails(formData);
    toast({
      title: "Welcome!",
      description: "Your details have been saved. You can now participate in quizzes.",
    });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/70">
      <HomeButton />
      <div className="max-w-md mx-auto px-4 py-16">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-8">
          <div className="text-center mb-8">
            <UserCircle className="h-16 w-16 text-secondary mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Guest Registration</h1>
            <p className="text-white/80">
              Enter your details to participate as a guest
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-white">Full Name *</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                required
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-white">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                required
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-white">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="10-digit mobile number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                maxLength={10}
                required
              />
            </div>

            <div className="bg-secondary/20 border border-secondary/40 rounded-lg p-4">
              <p className="text-white/80 text-sm">
                <strong>Note:</strong> We'll use these details to contact you if you win. 
                Guest users won't receive email/SMS notifications for quiz updates.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-gold text-lg py-6"
            >
              Continue to Quiz Dashboard
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default GuestRegister;
