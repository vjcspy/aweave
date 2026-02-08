import { MessageSquare } from 'lucide-react';

export default function DebatesPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
      <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
      <p className="text-lg">Select a debate to view</p>
      <p className="text-sm mt-1">or wait for a new one to appear</p>
    </div>
  );
}
