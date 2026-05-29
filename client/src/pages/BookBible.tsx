import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Book } from "@shared/schema";
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Save,
  Trash2,
  Users,
  MapPin,
  GitBranch,
  Flag,
  ScrollText,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types — kept loose so we can iterate the JSONB shape without schema migrations.
// Server stores `entities` as a free-form JSONB blob.
// ─────────────────────────────────────────────────────────────────────────────
interface Character {
  name: string;
  role?: string;
  description?: string;
  arc?: string;
  voice?: string;
  relationships?: { to: string; type: string }[];
}
interface Location {
  name: string;
  description?: string;
}
interface PlotThread {
  name: string;
  status?: "open" | "resolved" | "abandoned";
  description?: string;
}
interface Faction {
  name: string;
  description?: string;
}
interface BookEntities {
  characters?: Character[];
  locations?: Location[];
  plotThreads?: PlotThread[];
  factions?: Faction[];
  rules?: string[];
}
interface BookBible {
  id: number;
  bookId: number;
  premise: string | null;
  setting: string | null;
  themes: string | null;
  styleGuide: string | null;
  glossary: string | null;
  rollingSummary: string | null;
  language: string;
  entities: BookEntities;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function BookBiblePage() {
  const { bookId } = useParams<{ bookId: string }>();
  const { toast } = useToast();
  const id = Number(bookId);

  // Local form state — the bible is a single editable object.
  const [premise, setPremise] = useState("");
  const [setting, setSetting] = useState("");
  const [themes, setThemes] = useState("");
  const [styleGuide, setStyleGuide] = useState("");
  const [glossary, setGlossary] = useState("");
  const [rollingSummary, setRollingSummary] = useState("");
  const [language, setLanguage] = useState("English");
  const [entities, setEntities] = useState<BookEntities>({});
  const [dirty, setDirty] = useState(false);

  const { data: book, isLoading: bookLoading } = useQuery({
    queryKey: ["/api/books", id],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/books/${id}`, undefined);
      return (await r.json()) as Book;
    },
    enabled: !Number.isNaN(id),
  });

  const { data: bible, isLoading: bibleLoading } = useQuery({
    queryKey: ["/api/books", id, "bible"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/books/${id}/bible`, undefined);
      return (await r.json()) as BookBible | null;
    },
    enabled: !Number.isNaN(id),
  });

  // Hydrate form when the bible loads.
  useEffect(() => {
    if (!bible) return;
    setPremise(bible.premise ?? "");
    setSetting(bible.setting ?? "");
    setThemes(bible.themes ?? "");
    setStyleGuide(bible.styleGuide ?? "");
    setGlossary(bible.glossary ?? "");
    setRollingSummary(bible.rollingSummary ?? "");
    setLanguage(bible.language ?? "English");
    setEntities(bible.entities ?? {});
    setDirty(false);
  }, [bible]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        premise: premise || null,
        setting: setting || null,
        themes: themes || null,
        styleGuide: styleGuide || null,
        glossary: glossary || null,
        rollingSummary: rollingSummary || null,
        language,
        entities,
      };
      const r = await apiRequest("PUT", `/api/books/${id}/bible`, body);
      return (await r.json()) as BookBible;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books", id, "bible"] });
      setDirty(false);
      toast({ title: "Story bible saved" });
    },
    onError: (err: any) => {
      toast({
        title: "Save failed",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const onChange = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const counts = useMemo(
    () => ({
      characters: entities.characters?.length ?? 0,
      locations: entities.locations?.length ?? 0,
      plotThreads: entities.plotThreads?.length ?? 0,
      factions: entities.factions?.length ?? 0,
      rules: entities.rules?.length ?? 0,
    }),
    [entities],
  );

  if (bookLoading || bibleLoading) {
    return (
      <div className="container mx-auto max-w-5xl py-8 px-4">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/editor/${id}`}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to editor
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Story Bible
            {book && <span className="text-muted-foreground">— {book.title}</span>}
          </h1>
          <p className="text-muted-foreground mt-1">
            Everything in here gets injected into every AI generation as `STORY CONTEXT` so
            characters, plot threads, and world rules stay consistent across the whole book.
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {dirty ? "Save changes" : "Saved"}
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="characters">
            Characters <Badge variant="secondary" className="ml-1.5">{counts.characters}</Badge>
          </TabsTrigger>
          <TabsTrigger value="locations">
            Locations <Badge variant="secondary" className="ml-1.5">{counts.locations}</Badge>
          </TabsTrigger>
          <TabsTrigger value="plot">
            Plot <Badge variant="secondary" className="ml-1.5">{counts.plotThreads}</Badge>
          </TabsTrigger>
          <TabsTrigger value="factions">
            Factions <Badge variant="secondary" className="ml-1.5">{counts.factions}</Badge>
          </TabsTrigger>
          <TabsTrigger value="rules">
            Rules <Badge variant="secondary" className="ml-1.5">{counts.rules}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Premise</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={3}
                value={premise}
                placeholder="What's the book about? (1-3 sentences the model will hold in mind every chapter)"
                onChange={(e) => onChange(setPremise)(e.target.value)}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Setting</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                value={setting}
                placeholder="World, era, tone of place. Real-world city? Secondary world? Near-future? What does it look, smell, sound like?"
                onChange={(e) => onChange(setSetting)(e.target.value)}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Themes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={3}
                value={themes}
                placeholder="What is this book actually about underneath the plot? Grief? Power? Belonging?"
                onChange={(e) => onChange(setThemes)(e.target.value)}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Style guide</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                value={styleGuide}
                placeholder="Voice, POV, tense, sentence rhythm. ('First person past, present tense for dream sequences. Spare dialogue. No purple prose.')"
                onChange={(e) => onChange(setStyleGuide)(e.target.value)}
              />
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Glossary</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={5}
                  value={glossary}
                  placeholder={"Term — definition\nKaer — fortified valley settlement\nDjinn-tongue — ritual language"}
                  onChange={(e) => onChange(setGlossary)(e.target.value)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Story so far (rolling summary)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={5}
                  value={rollingSummary}
                  placeholder="High-level recap of events to date. Updated as the book grows."
                  onChange={(e) => onChange(setRollingSummary)(e.target.value)}
                />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Language</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Input
                  className="max-w-xs"
                  value={language}
                  onChange={(e) => onChange(setLanguage)(e.target.value)}
                  placeholder="English, Español, हिन्दी, 日本語…"
                />
                <span className="text-sm text-muted-foreground">
                  The model will generate prose in this language.
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CHARACTERS */}
        <TabsContent value="characters" className="space-y-3 mt-4">
          <EntityList
            icon={<Users className="h-5 w-5" />}
            title="Characters"
            description="Names, roles, voices, arcs. Relationships are pulled into prompts so the model stays consistent."
            items={entities.characters ?? []}
            onChange={(items) => onChange(setEntities)({ ...entities, characters: items })}
            renderRow={(c, idx, onUpdate, onDelete) => (
              <CharacterRow key={idx} value={c} onChange={onUpdate} onDelete={onDelete} />
            )}
            blank={() =>
              ({ name: "New character", role: "", description: "" }) as Character
            }
          />
        </TabsContent>

        {/* LOCATIONS */}
        <TabsContent value="locations" className="space-y-3 mt-4">
          <EntityList
            icon={<MapPin className="h-5 w-5" />}
            title="Locations"
            description="Places that matter — cities, rooms, planets, dreamscapes."
            items={entities.locations ?? []}
            onChange={(items) => onChange(setEntities)({ ...entities, locations: items })}
            renderRow={(l, idx, onUpdate, onDelete) => (
              <SimpleNamedRow key={idx} value={l} onChange={onUpdate} onDelete={onDelete} />
            )}
            blank={() => ({ name: "New location", description: "" }) as Location}
          />
        </TabsContent>

        {/* PLOT THREADS */}
        <TabsContent value="plot" className="space-y-3 mt-4">
          <EntityList
            icon={<GitBranch className="h-5 w-5" />}
            title="Plot threads"
            description="Story arcs the model should pay off, foreshadow, or resolve."
            items={entities.plotThreads ?? []}
            onChange={(items) => onChange(setEntities)({ ...entities, plotThreads: items })}
            renderRow={(p, idx, onUpdate, onDelete) => (
              <PlotThreadRow key={idx} value={p} onChange={onUpdate} onDelete={onDelete} />
            )}
            blank={() =>
              ({ name: "New thread", status: "open", description: "" }) as PlotThread
            }
          />
        </TabsContent>

        {/* FACTIONS */}
        <TabsContent value="factions" className="space-y-3 mt-4">
          <EntityList
            icon={<Flag className="h-5 w-5" />}
            title="Factions / groups"
            description="Houses, guilds, governments, schools, gangs, families."
            items={entities.factions ?? []}
            onChange={(items) => onChange(setEntities)({ ...entities, factions: items })}
            renderRow={(f, idx, onUpdate, onDelete) => (
              <SimpleNamedRow key={idx} value={f} onChange={onUpdate} onDelete={onDelete} />
            )}
            blank={() => ({ name: "New faction", description: "" }) as Faction}
          />
        </TabsContent>

        {/* RULES */}
        <TabsContent value="rules" className="space-y-3 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5" /> World rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Hard constraints the model must respect. ("Magic costs memory.", "No-one
                can lie under the second moon.")
              </p>
              {(entities.rules ?? []).map((rule, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={rule}
                    onChange={(e) => {
                      const next = [...(entities.rules ?? [])];
                      next[idx] = e.target.value;
                      onChange(setEntities)({ ...entities, rules: next });
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const next = (entities.rules ?? []).filter((_, i) => i !== idx);
                      onChange(setEntities)({ ...entities, rules: next });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onChange(setEntities)({
                    ...entities,
                    rules: [...(entities.rules ?? []), ""],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Add rule
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sticky save bar when dirty */}
      {dirty && (
        <div className="sticky bottom-4 mt-6 flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Save story bible
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic add/remove list shell.
// ─────────────────────────────────────────────────────────────────────────────
function EntityList<T>({
  icon,
  title,
  description,
  items,
  onChange,
  renderRow,
  blank,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  items: T[];
  onChange: (items: T[]) => void;
  renderRow: (
    item: T,
    idx: number,
    onUpdate: (next: T) => void,
    onDelete: () => void,
  ) => React.ReactNode;
  blank: () => T;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{icon} {title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm italic text-muted-foreground">Nothing yet.</p>
        )}
        {items.map((item, idx) =>
          renderRow(
            item,
            idx,
            (next) => {
              const arr = [...items];
              arr[idx] = next;
              onChange(arr);
            },
            () => onChange(items.filter((_, i) => i !== idx)),
          ),
        )}
        <Separator />
        <Button variant="outline" size="sm" onClick={() => onChange([...items, blank()])}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardContent>
    </Card>
  );
}

function CharacterRow({
  value,
  onChange,
  onDelete,
}: {
  value: Character;
  onChange: (next: Character) => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-border rounded-md p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          className="font-medium"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Name"
        />
        <Input
          className="max-w-[180px]"
          value={value.role ?? ""}
          onChange={(e) => onChange({ ...value, role: e.target.value })}
          placeholder="Role (protagonist, foil…)"
        />
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Textarea
        rows={2}
        value={value.description ?? ""}
        onChange={(e) => onChange({ ...value, description: e.target.value })}
        placeholder="Description — appearance, personality, motivation"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Input
          value={value.voice ?? ""}
          onChange={(e) => onChange({ ...value, voice: e.target.value })}
          placeholder="Voice (clipped, formal, prone to sarcasm…)"
        />
        <Input
          value={value.arc ?? ""}
          onChange={(e) => onChange({ ...value, arc: e.target.value })}
          placeholder="Arc (cynic → believer, etc.)"
        />
      </div>
    </div>
  );
}

function PlotThreadRow({
  value,
  onChange,
  onDelete,
}: {
  value: PlotThread;
  onChange: (next: PlotThread) => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-border rounded-md p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          className="font-medium"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Thread name"
        />
        <select
          className="text-sm bg-background border border-border rounded-md h-9 px-2"
          value={value.status ?? "open"}
          onChange={(e) =>
            onChange({ ...value, status: e.target.value as PlotThread["status"] })
          }
        >
          <option value="open">open</option>
          <option value="resolved">resolved</option>
          <option value="abandoned">abandoned</option>
        </select>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Textarea
        rows={2}
        value={value.description ?? ""}
        onChange={(e) => onChange({ ...value, description: e.target.value })}
        placeholder="What this thread is and what payoff it needs"
      />
    </div>
  );
}

function SimpleNamedRow({
  value,
  onChange,
  onDelete,
}: {
  value: { name: string; description?: string };
  onChange: (next: { name: string; description?: string }) => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-border rounded-md p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          className="font-medium"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Name"
        />
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Textarea
        rows={2}
        value={value.description ?? ""}
        onChange={(e) => onChange({ ...value, description: e.target.value })}
        placeholder="Description"
      />
    </div>
  );
}
