export default function Loading() {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F2EB] gap-4">
        <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-700 rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }