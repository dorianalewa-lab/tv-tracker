import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RotateCcw, Sparkles, ArrowRight } from 'lucide-react';
import {
  MOOD_OPTIONS, TIME_OPTIONS, FORMAT_OPTIONS, SAFETY_OPTIONS,
  buildDiscoverParams, summarizeConversation,
  type Answers, type Mood, type TimeSlot, type FormatChoice, type Safety,
} from '../lib/ask';
import {
  discoverWithParams, getGenreMap, posterUrl, getProvidersForRegion,
  type DiscoverResult, type RegionProvider, IMG_BASE,
} from '../api/tmdb';
import { useDB } from '../hooks/useLibrary';
import { updateProfile } from '../storage/library';
import { computeProfile } from '../lib/recommendations';

type StepKey = 'mood' | 'time' | 'format' | 'platforms' | 'genres' | 'safety';
const STEP_ORDER_FULL: StepKey[] = ['mood', 'time', 'format', 'platforms', 'genres', 'safety'];
const STEP_ORDER_NO_PLATFORMS: StepKey[] = ['mood', 'time', 'format', 'genres', 'safety'];

type Turn =
  | { who: 'bot'; content: React.ReactNode; key: string }
  | { who: 'user'; content: React.ReactNode; key: string };

export function AskScreen() {
  const db = useDB();
  const profile = useMemo(() => computeProfile(db), [db]);
  const ownedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const it of Object.values(db.items)) s.add(`${it.mediaType}:${it.tmdbId}`);
    return s;
  }, [db.items]);

  const [answers, setAnswers] = useState<Answers>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [availableGenres, setAvailableGenres] = useState<string[] | null>(null);
  const [pickedGenres, setPickedGenres] = useState<string[]>([]);
  const [availableProviders, setAvailableProviders] = useState<RegionProvider[] | null>(null);
  const [pickedProviders, setPickedProviders] = useState<number[]>([]);
  const [results, setResults] = useState<DiscoverResult[] | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Snapshot au mount : évite que STEP_ORDER change en cours de conv
  // quand l'user valide ses plateformes (qui remplit `profile.providers`).
  const [hasProvidersInProfileAtMount] = useState(() => db.profile.providers.length > 0);
  const STEP_ORDER = hasProvidersInProfileAtMount ? STEP_ORDER_NO_PLATFORMS : STEP_ORDER_FULL;
  const currentStepKey = STEP_ORDER[stepIdx];
  const done = stepIdx >= STEP_ORDER.length;

  // Message de bienvenue + première question
  useEffect(() => {
    if (turns.length === 0) {
      setTurns([
        { who: 'bot', key: 'hello', content: 'Salut ! Je te pose 5 petites questions et je te propose ce qu\'il te faut ce soir 👇' },
        { who: 'bot', key: 'q-mood', content: 'Ton mood ce soir ?' },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll à chaque nouveau turn
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, results, loadingResults]);

  // Charge la liste des genres FR quand on arrive à l'étape "genres"
  useEffect(() => {
    if (currentStepKey !== 'genres' || availableGenres) return;
    Promise.all([getGenreMap('tv'), getGenreMap('movie')]).then(([tv, movie]) => {
      const set = new Set<string>([...tv.keys(), ...movie.keys()]);
      setAvailableGenres(Array.from(set).sort());
    }).catch(() => setAvailableGenres([]));
  }, [currentStepKey, availableGenres]);

  // Charge la liste des providers quand on arrive à l'étape "platforms"
  useEffect(() => {
    if (currentStepKey !== 'platforms' || availableProviders) return;
    getProvidersForRegion(db.profile.region)
      .then((p) => setAvailableProviders(p.slice(0, 20)))
      .catch(() => setAvailableProviders([]));
  }, [currentStepKey, availableProviders, db.profile.region]);

  function answer<K extends StepKey>(key: K, value: unknown, userLabel: string, nextBotPrompt?: string) {
    setAnswers((a) => ({ ...a, [key]: value }));
    setTurns((prev) => {
      const next: Turn[] = [...prev, { who: 'user', key: `u-${key}-${Date.now()}`, content: userLabel }];
      if (nextBotPrompt) {
        next.push({ who: 'bot', key: `b-${key}-next-${Date.now()}`, content: nextBotPrompt });
      }
      return next;
    });
    setStepIdx((i) => i + 1);
  }

  function handleMood(m: Mood) {
    const opt = MOOD_OPTIONS.find((o) => o.key === m)!;
    answer('mood', m, `${opt.emoji} ${opt.label}`, 'Combien de temps t\'as ?');
  }
  function handleTime(t: TimeSlot) {
    const opt = TIME_OPTIONS.find((o) => o.key === t)!;
    answer('time', t, opt.label, 'Plutôt film ou série ?');
  }
  function handleFormat(f: FormatChoice) {
    const opt = FORMAT_OPTIONS.find((o) => o.key === f)!;
    const nextPrompt = hasProvidersInProfileAtMount
      ? 'Un genre en tête ? (facultatif, tu peux en cocher plusieurs ou passer)'
      : 'Sur quelles plateformes tu as accès ? Je m\'en souviendrai pour la prochaine fois.';
    answer('format', f, `${opt.emoji} ${opt.label}`, nextPrompt);
  }
  function handlePlatforms() {
    updateProfile({ providers: pickedProviders });
    const label = pickedProviders.length === 0
      ? 'Aucune préférence'
      : `${pickedProviders.length} plateforme${pickedProviders.length > 1 ? 's' : ''}`;
    setTurns((prev) => [
      ...prev,
      { who: 'user', key: `u-platforms-${Date.now()}`, content: label },
      { who: 'bot', key: `b-platforms-next-${Date.now()}`, content: 'Un genre en tête ? (facultatif, tu peux en cocher plusieurs ou passer)' },
    ]);
    setStepIdx((i) => i + 1);
  }
  function handleGenres(skip: boolean) {
    const label = skip || pickedGenres.length === 0 ? 'Peu importe' : pickedGenres.join(', ');
    answer('genres', skip ? [] : pickedGenres, label, 'Dernière : plutôt valeur sûre ou découverte ?');
  }
  function handleSafety(s: Safety) {
    const opt = SAFETY_OPTIONS.find((o) => o.key === s)!;
    setAnswers((a) => ({ ...a, safety: s }));
    setTurns((prev) => [
      ...prev,
      { who: 'user', key: `u-safety-${Date.now()}`, content: opt.label },
      { who: 'bot', key: `b-cooking-${Date.now()}`, content: 'Je te cherche ça…' },
    ]);
    setStepIdx((i) => i + 1);
  }

  // Lance la recherche quand toutes les réponses sont là
  useEffect(() => {
    if (!done || results !== null || loadingResults) return;
    (async () => {
      setLoadingResults(true);
      setError(null);
      try {
        const [tvMap, movieMap] = await Promise.all([getGenreMap('tv'), getGenreMap('movie')]);
        const topProfileGenres = profile.topGenres.map((g) => g.name);
        const format = answers.format ?? 'any';
        const watchOpts = db.profile.providers.length > 0
          ? { providers: db.profile.providers, region: db.profile.region }
          : undefined;

        const calls: Promise<DiscoverResult[]>[] = [];
        if (format === 'movie' || format === 'any') {
          const params = buildDiscoverParams(answers, 'movie', movieMap, topProfileGenres, watchOpts);
          const { mediaType, ...rest } = params;
          void mediaType;
          calls.push(discoverWithParams('movie', rest as Record<string, string | number>).then(tag('movie')));
        }
        if (format === 'tv' || format === 'any') {
          const params = buildDiscoverParams(answers, 'tv', tvMap, topProfileGenres, watchOpts);
          const { mediaType, ...rest } = params;
          void mediaType;
          calls.push(discoverWithParams('tv', rest as Record<string, string | number>).then(tag('tv')));
        }

        const arrays = await Promise.all(calls);
        let merged = arrays.flat();
        // Exclut ce qui est déjà en biblio
        merged = merged.filter((r) => !ownedKeys.has(`${resolvedMediaType(r)}:${r.id}`));
        // Mixe film/série équitablement + limite à 8
        merged = interleaveByType(merged).slice(0, 8);
        setResults(merged);
      } catch (e) {
        setError(String((e as Error).message ?? e));
      } finally {
        setLoadingResults(false);
      }
    })();
  }, [done, results, loadingResults, answers, profile.topGenres, ownedKeys]);

  function restart() {
    setAnswers({});
    setStepIdx(0);
    setPickedGenres([]);
    setResults(null);
    setError(null);
    setTurns([
      { who: 'bot', key: 'hello-2', content: 'On refait un tour ? Ton mood cette fois ?' },
    ]);
  }

  return (
    <div className="min-h-full pb-24 flex flex-col">
      <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent" />
            <h1 className="text-lg font-bold">Coach du soir</h1>
          </div>
          {(stepIdx > 0 || results !== null) && (
            <button onClick={restart} className="text-xs text-muted flex items-center gap-1">
              <RotateCcw size={14} /> Recommencer
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 px-4 pt-4 space-y-3 overflow-y-auto">
        {turns.map((t) => (
          <Bubble key={t.key} who={t.who}>{t.content}</Bubble>
        ))}

        {/* Zone d'action selon l'étape courante */}
        {!done && currentStepKey === 'mood' && (
          <Choices>
            {MOOD_OPTIONS.map((o) => (
              <Chip key={o.key} onClick={() => handleMood(o.key)}>
                <span className="mr-1">{o.emoji}</span>{o.label}
              </Chip>
            ))}
          </Choices>
        )}

        {!done && currentStepKey === 'time' && (
          <Choices>
            {TIME_OPTIONS.map((o) => (
              <Chip key={o.key} onClick={() => handleTime(o.key)} sub={o.hint}>{o.label}</Chip>
            ))}
          </Choices>
        )}

        {!done && currentStepKey === 'format' && (
          <Choices>
            {FORMAT_OPTIONS.map((o) => (
              <Chip key={o.key} onClick={() => handleFormat(o.key)}>
                <span className="mr-1">{o.emoji}</span>{o.label}
              </Chip>
            ))}
          </Choices>
        )}

        {!done && currentStepKey === 'platforms' && (
          <div className="pt-1">
            {!availableProviders ? (
              <div className="text-muted text-sm">Chargement des plateformes…</div>
            ) : availableProviders.length === 0 ? (
              <div className="text-muted text-sm">Aucune plateforme trouvée pour ta région.</div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {availableProviders.map((p) => {
                    const on = pickedProviders.includes(p.provider_id);
                    return (
                      <button
                        key={p.provider_id}
                        onClick={() =>
                          setPickedProviders((prev) =>
                            on ? prev.filter((x) => x !== p.provider_id) : [...prev, p.provider_id]
                          )
                        }
                        className={`relative p-1.5 rounded-xl border transition ${
                          on ? 'border-accent bg-accent/10' : 'border-border bg-surface opacity-70'
                        }`}
                        title={p.provider_name}
                      >
                        <img
                          src={`${IMG_BASE}/w92${p.logo_path}`}
                          alt={p.provider_name}
                          className="w-full aspect-square rounded-md object-cover"
                          loading="lazy"
                        />
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={handlePlatforms}
                  className="w-full py-2.5 rounded-lg bg-accent text-black text-sm font-medium"
                >
                  {pickedProviders.length > 0 ? `Valider (${pickedProviders.length})` : 'Passer'}
                </button>
              </>
            )}
          </div>
        )}

        {!done && currentStepKey === 'genres' && (
          <div className="pt-1">
            {!availableGenres ? (
              <div className="text-muted text-sm">Chargement des genres…</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {availableGenres.map((g) => {
                    const active = pickedGenres.includes(g);
                    return (
                      <button
                        key={g}
                        onClick={() =>
                          setPickedGenres((prev) =>
                            active ? prev.filter((x) => x !== g) : [...prev, g]
                          )
                        }
                        className={`text-xs px-3 py-1.5 rounded-full border transition ${
                          active
                            ? 'bg-accent text-black border-accent font-medium'
                            : 'border-border text-muted'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleGenres(true)}
                    className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted"
                  >
                    Passer
                  </button>
                  <button
                    onClick={() => handleGenres(false)}
                    disabled={pickedGenres.length === 0}
                    className="flex-1 py-2.5 rounded-lg bg-accent text-black text-sm font-medium disabled:opacity-40"
                  >
                    Valider {pickedGenres.length > 0 && `(${pickedGenres.length})`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {!done && currentStepKey === 'safety' && (
          <Choices>
            {SAFETY_OPTIONS.map((o) => (
              <Chip key={o.key} onClick={() => handleSafety(o.key)} sub={o.hint}>{o.label}</Chip>
            ))}
          </Choices>
        )}

        {/* Résultats */}
        {done && (
          <div className="pt-4">
            {loadingResults && (
              <div className="flex items-center gap-2 text-muted text-sm py-4">
                <Loader2 size={16} className="animate-spin" /> Je regarde ce qui matche…
              </div>
            )}
            {error && <div className="text-red-400 text-sm py-4">{error}</div>}
            {results && (
              <>
                <Bubble who="bot">{summarizeConversation(answers)}</Bubble>
                {results.length === 0 ? (
                  <div className="text-muted text-sm py-6 text-center">
                    Rien de convaincant avec ces filtres — recommence en élargissant ?
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-3">
                    {results.map((r) => {
                      const mt = resolvedMediaType(r);
                      const title = (mt === 'tv' ? r.name : r.title) ?? '(sans titre)';
                      const dateStr = mt === 'tv' ? r.first_air_date : r.release_date;
                      const year = dateStr ? Number(dateStr.slice(0, 4)) : null;
                      return (
                        <Link
                          key={`${mt}:${r.id}`}
                          to={mt === 'tv' ? `/show/${r.id}` : `/movie/${r.id}`}
                          className="flex gap-3 p-2 rounded-xl bg-surface border border-border active:bg-border/40 transition-colors"
                        >
                          <div className="w-16 h-24 shrink-0 rounded-md overflow-hidden bg-bg border border-border">
                            {posterUrl(r.poster_path, 'w154') ? (
                              <img src={posterUrl(r.poster_path, 'w154')!} alt="" className="w-full h-full object-cover" />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0 py-0.5">
                            <div className="font-medium leading-tight line-clamp-2">{title}</div>
                            <div className="text-[11px] text-muted mt-0.5">
                              {mt === 'tv' ? 'Série' : 'Film'}{year ? ` · ${year}` : ''}
                              {typeof r.vote_average === 'number' && r.vote_average > 0 && (
                                <> · ★ {r.vote_average.toFixed(1)}</>
                              )}
                            </div>
                            {r.overview && (
                              <p className="mt-1 text-xs text-muted leading-snug line-clamp-2">
                                {r.overview}
                              </p>
                            )}
                          </div>
                          <ArrowRight size={16} className="text-muted self-center shrink-0" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}

/* ---------------- UI helpers ---------------- */

function Bubble({ who, children }: { who: 'bot' | 'user'; children: React.ReactNode }) {
  const isBot = who === 'bot';
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} chat-fade-in`}>
      <div
        className={`max-w-[85%] px-3.5 py-2.5 text-sm rounded-2xl ${
          isBot
            ? 'bg-surface border border-border text-text rounded-bl-sm'
            : 'bg-accent text-black rounded-br-sm font-medium'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Choices({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2 pt-1 pb-2">{children}</div>;
}

function Chip({
  children,
  onClick,
  sub,
}: {
  children: React.ReactNode;
  onClick: () => void;
  sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-xl border border-border bg-bg hover:border-muted active:scale-95 transition text-left"
    >
      <div className="text-sm">{children}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
    </button>
  );
}

/* ---------------- helpers ---------------- */

// `discover` renvoie des items sans `media_type` — on l'ajoute au moment du fetch.
function tag(mt: 'tv' | 'movie') {
  return (arr: DiscoverResult[]) => arr.map((r) => Object.assign(r, { __mt: mt }));
}
function resolvedMediaType(r: DiscoverResult): 'tv' | 'movie' {
  // Champ interne ajouté par tag(). On check aussi les champs propres au type.
  const mt = (r as unknown as { __mt?: 'tv' | 'movie' }).__mt;
  if (mt) return mt;
  if (r.first_air_date != null || r.name != null) return 'tv';
  return 'movie';
}

/** Mixe les résultats film/série pour ne pas avoir toutes les séries en premier. */
function interleaveByType(list: DiscoverResult[]): DiscoverResult[] {
  const tvs = list.filter((r) => resolvedMediaType(r) === 'tv');
  const movies = list.filter((r) => resolvedMediaType(r) === 'movie');
  const out: DiscoverResult[] = [];
  const n = Math.max(tvs.length, movies.length);
  for (let i = 0; i < n; i++) {
    if (tvs[i]) out.push(tvs[i]);
    if (movies[i]) out.push(movies[i]);
  }
  return out;
}
