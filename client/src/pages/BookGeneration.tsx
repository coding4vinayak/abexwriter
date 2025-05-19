import BookGenerator from "@/components/BookGenerator";

export default function BookGeneration() {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-gray-200 pb-5 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">AI Book Generation</h2>
          <p className="mt-2 text-sm text-gray-500">Generate complete books chapter by chapter with perfect grammar using your LLM</p>
        </div>
        
        <BookGenerator />
      </div>
    </div>
  );
}