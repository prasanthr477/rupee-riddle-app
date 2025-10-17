import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export const HomeButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      onClick={() => navigate('/')}
      variant="ghost"
      size="sm"
      className="fixed top-4 left-4 z-50 bg-background/80 backdrop-blur-sm hover:bg-background/90"
    >
      <Home className="h-4 w-4 mr-2" />
      Home
    </Button>
  );
};
