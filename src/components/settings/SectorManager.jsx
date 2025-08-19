
import React, { useState, useEffect } from "react";
import { Sector } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Tag, Loader2 } from "lucide-react";

export default function SectorManager() {
  const [sectors, setSectors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSector, setCurrentSector] = useState(null); // For editing
  const [formData, setFormData] = useState({ name: "", description: "" });

  useEffect(() => {
    loadSectors();
  }, []);

  const loadSectors = async () => {
    setIsLoading(true);
    const sectorData = await Sector.list("-created_date");
    setSectors(sectorData);
    setIsLoading(false);
  };

  const handleAddNew = () => {
    setCurrentSector(null);
    setFormData({ name: "", description: "" });
    setIsDialogOpen(true);
  };

  const handleEdit = (sector) => {
    setCurrentSector(sector);
    setFormData({ name: sector.name, description: sector.description || "" });
    setIsDialogOpen(true);
  };

  const handleDelete = async (sectorId) => {
    if (window.confirm("Are you sure you want to delete this sector? This action cannot be undone.")) {
      try {
        await Sector.delete(sectorId);
        loadSectors(); // Reload on success
      } catch (error) {
        console.error("Failed to delete sector:", error);
        alert("Failed to delete sector. It may still be in use by some transactions.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (currentSector) {
        // Update existing sector
        await Sector.update(currentSector.id, formData);
      } else {
        // Create new sector
        await Sector.create(formData);
      }
      setIsDialogOpen(false);
      loadSectors();
    } catch (error) {
      console.error("Failed to save sector:", error);
      // Here you could add user-facing error handling
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Tag className="w-5 h-5 text-blue-600" />
            Manage Sectors
          </CardTitle>
          <Button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Sector
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center p-8">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
                <p className="mt-2 text-slate-500">Loading sectors...</p>
              </div>
            ) : sectors.length > 0 ? (
              sectors.map((sector) => (
                <div key={sector.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <h3 className="font-semibold text-slate-800">{sector.name}</h3>
                    <p className="text-sm text-slate-500">{sector.description || 'No description'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(sector)}>
                      <Edit className="w-4 h-4 text-slate-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(sector.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center p-8 border-2 border-dashed border-slate-300 rounded-lg">
                <h3 className="font-semibold text-slate-700">No Sectors Found</h3>
                <p className="text-sm text-slate-500 mt-1">Click "Add Sector" to create your first one.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentSector ? "Edit Sector" : "Add New Sector"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Sector Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Enterprise Software"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., B2B software companies"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Sector"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
