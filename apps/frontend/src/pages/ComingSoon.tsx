export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="p-6 flex items-center justify-center h-full">
      <div className="text-center">
        <div className="text-5xl mb-4">🚧</div>
        <h1 className="text-xl font-bold text-white mb-2">{title}</h1>
        <p className="text-slate-400 text-sm">En desarrollo</p>
      </div>
    </div>
  );
}
