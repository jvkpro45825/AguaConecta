import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageCircle, Users, Smartphone } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-redirect to client platform for PWA users
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('source') === 'pwa') {
      navigate('/client');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <MessageCircle className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-800 mb-2">AguaConecta</h1>
        <p className="text-gray-600 mb-8">Professional Communication Platform</p>
        
        <div className="space-y-4">
          <Button 
            onClick={() => navigate('/client')}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg flex items-center justify-center gap-2"
          >
            <Users className="w-5 h-5" />
            Client Access
          </Button>
          
          <Button 
            onClick={() => navigate('/developer')}
            variant="outline"
            className="w-full border-blue-300 text-blue-600 hover:bg-blue-50 py-3 rounded-lg flex items-center justify-center gap-2"
          >
            <Smartphone className="w-5 h-5" />
            Developer Portal
          </Button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Real-time messaging • Project management • PWA enabled
          </p>
        </div>
      </div>
    </div>
  );
};

export default Landing;