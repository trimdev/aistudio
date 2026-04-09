import { Loader2 } from "lucide-react";

export default function ProjectsLoading() {
  return (
    <div className="p-8 flex items-center justify-center h-64">
      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
    </div>
  );
}
