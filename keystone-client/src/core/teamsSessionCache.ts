import type { TeamsDataSource } from "./teams";
import type { ClientTeamDetail, ClientTeamSummary, KeystoneSelectorResponse } from "./types";

type SelectorLocale = "es_ES" | "en_US";

let generation = 0;
let teams: ClientTeamSummary[] | null = null;
let selectedTeamId: number | null = null;
let listInFlight: Promise<ClientTeamSummary[]> | null = null;
const teamDetails = new Map<number, ClientTeamDetail>();
const detailInFlight = new Map<number, Promise<ClientTeamDetail>>();
const selectors = new Map<string, KeystoneSelectorResponse>();
const selectorInFlight = new Map<string, Promise<KeystoneSelectorResponse>>();

function selectorKey(teamId: number, challengeMapId: number, locale: SelectorLocale): string {
  return `${teamId}:${challengeMapId}:${locale}`;
}

function deleteCachedTeamData(teamId: number): void {
  teamDetails.delete(teamId);
  const prefix = `${teamId}:`;
  for (const key of selectors.keys()) {
    if (key.startsWith(prefix)) selectors.delete(key);
  }
}

function pruneCachedTeamData(allowedTeamIds: Set<number>): void {
  for (const teamId of teamDetails.keys()) {
    if (!allowedTeamIds.has(teamId)) deleteCachedTeamData(teamId);
  }
  for (const key of selectors.keys()) {
    const teamId = Number(key.slice(0, key.indexOf(":")));
    if (!allowedTeamIds.has(teamId)) selectors.delete(key);
  }
}

export function getTeamsSessionSnapshot(): {
  teams: ClientTeamSummary[] | null;
  selectedTeamId: number | null;
} {
  return { teams, selectedTeamId };
}

export function getCachedTeamDetail(teamId: number): ClientTeamDetail | null {
  return teamDetails.get(teamId) ?? null;
}

export function getCachedSelector(
  teamId: number,
  challengeMapId: number,
  locale: SelectorLocale,
): KeystoneSelectorResponse | null {
  return selectors.get(selectorKey(teamId, challengeMapId, locale)) ?? null;
}

export function setSelectedTeamId(teamId: number | null): void {
  selectedTeamId = teamId;
}

export function loadTeams(dataSource: TeamsDataSource): Promise<ClientTeamSummary[]> {
  if (listInFlight) return listInFlight;
  const requestGeneration = generation;
  const request = dataSource.listTeams().then(result => {
    if (generation === requestGeneration) {
      teams = result;
      const allowedTeamIds = new Set(result.map(team => team.id));
      pruneCachedTeamData(allowedTeamIds);
      if (selectedTeamId !== null && !allowedTeamIds.has(selectedTeamId)) selectedTeamId = null;
    }
    return result;
  }).finally(() => {
    if (listInFlight === request) listInFlight = null;
  });
  listInFlight = request;
  return request;
}

export function loadTeamDetail(dataSource: TeamsDataSource, teamId: number): Promise<ClientTeamDetail> {
  const existing = detailInFlight.get(teamId);
  if (existing) return existing;
  const requestGeneration = generation;
  const request = dataSource.getTeam(teamId).then(result => {
    if (generation === requestGeneration && (teams === null || teams.some(team => team.id === teamId))) {
      teamDetails.set(teamId, result);
    }
    return result;
  }).finally(() => {
    if (detailInFlight.get(teamId) === request) detailInFlight.delete(teamId);
  });
  detailInFlight.set(teamId, request);
  return request;
}

export function loadSelector(
  dataSource: TeamsDataSource,
  teamId: number,
  challengeMapId: number,
  locale: SelectorLocale,
): Promise<KeystoneSelectorResponse> {
  const key = selectorKey(teamId, challengeMapId, locale);
  const existing = selectorInFlight.get(key);
  if (existing) return existing;
  const requestGeneration = generation;
  const request = dataSource.getKeystoneSelector(teamId, challengeMapId, locale).then(result => {
    if (generation === requestGeneration && (teams === null || teams.some(team => team.id === teamId))) {
      selectors.set(key, result);
    }
    return result;
  }).finally(() => {
    if (selectorInFlight.get(key) === request) selectorInFlight.delete(key);
  });
  selectorInFlight.set(key, request);
  return request;
}

export async function prefetchTeamsSession(dataSource: TeamsDataSource): Promise<void> {
  const currentTeams = await loadTeams(dataSource);
  if (currentTeams.length === 0) {
    setSelectedTeamId(null);
    return;
  }
  const targetTeamId = currentTeams.some(team => team.id === selectedTeamId)
    ? selectedTeamId as number
    : currentTeams[0].id;
  setSelectedTeamId(targetTeamId);
  await loadTeamDetail(dataSource, targetTeamId);
}

export function removeTeamFromSessionCache(teamId: number): void {
  if (teams) teams = teams.filter(team => team.id !== teamId);
  deleteCachedTeamData(teamId);
  if (selectedTeamId === teamId) selectedTeamId = null;
}

export function clearTeamsSessionCache(): void {
  generation += 1;
  teams = null;
  selectedTeamId = null;
  listInFlight = null;
  teamDetails.clear();
  detailInFlight.clear();
  selectors.clear();
  selectorInFlight.clear();
}
