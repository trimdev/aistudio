import Link from "next/link";
import { Plus, FolderOpen, Clock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listProjects } from "@/lib/projects";

const statusColor: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  processing: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
  pending: "bg-gray-100 text-gray-600",
};

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">All your ghost mannequin generations.</p>
        </div>
        <Link href="/studio/new">
          <Button className="bg-gray-900 text-white hover:bg-gray-700 gap-2">
            <Plus className="w-4 h-4" /> New generation
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="border-gray-100 shadow-none">
          <div className="p-16 text-center">
            <FolderOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="font-medium text-gray-900 mb-2">No projects yet</h3>
            <p className="text-sm text-gray-500 mb-6">
              Generate your first ghost mannequin shot to see it here.
            </p>
            <Link href="/studio/new">
              <Button className="bg-gray-900 text-white hover:bg-gray-700">
                Create first shot
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="border-gray-100 shadow-none hover:border-gray-200 transition-colors overflow-hidden"
            >
              <div className="flex gap-4 p-4">
                {project.output_image_url && (
                  <>
                    <div className="w-20 h-24 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={project.output_image_url}
                        alt="Output"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{project.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-400">
                          {new Date(project.created_at).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {project.prompt_used && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2 max-w-md">
                          {project.prompt_used}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        className={`text-[11px] font-medium px-2 py-0.5 capitalize rounded-full border-0 ${statusColor[project.status]}`}
                      >
                        {project.status}
                      </Badge>
                      {project.output_image_full_url && (
                        <a href={project.output_image_full_url} download target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm" className="h-7 px-2">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
