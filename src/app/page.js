import News from '@/components/News';

export default function Home() {
  return (
    <div className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">News Article Analyzer</h1>
        <News />
      </div>
    </div>
  );
}
