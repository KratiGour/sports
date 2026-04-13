import { useThemeStore } from '../store/themeStore';

export default function CoachContentPage() {
  const { theme } = useThemeStore();
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      <div className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-photo-video text-orange-400"></i>My Content
        </h1>
        <p className={`mt-1 text-sm ${sub}`}>Upload and manage your images, videos, and articles</p>
      </div>
      <div className={`rounded-3xl border p-16 text-center ${glass}`}>
        <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
          <i className={`fas fa-photo-video text-4xl ${sub}`}></i>
        </div>
        <p className="font-semibold text-lg mb-1">Coming soon</p>
        <p className={`text-sm ${sub}`}>Content management will be available here</p>
      </div>
    </div>
  );
}
