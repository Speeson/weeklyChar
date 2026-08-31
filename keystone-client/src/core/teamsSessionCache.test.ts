import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamsDataSource } from "./teams";
import type { ClientTeamDetail, KeystoneSelectorResponse } from "./types";
import {
  clearTeamsSessionCache,
  getCachedSelector,
  getCachedTeamDetail,
  getTeamsSessionSnapshot,
  loadSelector,
  loadTeamDetail,
  loadTeams,
  prefetchTeamsSession,
  setSelectedTeamId,
} from "./teamsSessionCache";

const teams = [{ id: 7, name: "Mythiqueros", memberCount: 1 }];
const detail: ClientTeamDetail = { id: 7, name: "Mythiqueros", members: [] };
const selector: KeystoneSelectorResponse = {
  teamId: 7,
  challengeMapId: 399,
  availability: { stoneCount: 0, stones: [] },
  summary: {
    charactersWithObjectives: 0,
    totalObjectives: 0,
    tiers: { bestInSlot: 0, mustHave: 0, niceToHave: 0, catalyst: 0, transmog: 0, other: 0 },
  },
  characters: [],
};

function source(overrides: Partial<TeamsDataSource> = {}): TeamsDataSource {
  return {
    listTeams: vi.fn(async () => teams),
    getTeam: vi.fn(async () => detail),
    getKeystoneSelector: vi.fn(async () => selector),
    ...overrides,
  };
}

describe("Teams session cache", () => {
  beforeEach(() => clearTeamsSessionCache());

  it("deduplicates concurrent list and detail consumers while caching both responses", async () => {
    let resolveList!: (value: typeof teams) => void;
    const listPromise = new Promise<typeof teams>(resolve => { resolveList = resolve; });
    let resolveDetail!: (value: ClientTeamDetail) => void;
    const detailPromise = new Promise<ClientTeamDetail>(resolve => { resolveDetail = resolve; });
    const dataSource = source({
      listTeams: vi.fn(() => listPromise),
      getTeam: vi.fn(() => detailPromise),
    });

    const firstList = loadTeams(dataSource);
    const secondList = loadTeams(dataSource);
    expect(dataSource.listTeams).toHaveBeenCalledOnce();
    resolveList(teams);
    await expect(Promise.all([firstList, secondList])).resolves.toEqual([teams, teams]);

    const firstDetail = loadTeamDetail(dataSource, 7);
    const secondDetail = loadTeamDetail(dataSource, 7);
    expect(dataSource.getTeam).toHaveBeenCalledOnce();
    resolveDetail(detail);
    await expect(Promise.all([firstDetail, secondDetail])).resolves.toEqual([detail, detail]);

    expect(getTeamsSessionSnapshot()).toEqual({ teams, selectedTeamId: null });
    expect(getCachedTeamDetail(7)).toEqual(detail);
  });

  it("isolates Selector cache entries by Team, dungeon and locale", async () => {
    const dataSource = source({
      getKeystoneSelector: vi.fn(async (teamId, challengeMapId) => ({ ...selector, teamId, challengeMapId })),
    });

    await loadSelector(dataSource, 7, 399, "es_ES");
    await loadSelector(dataSource, 7, 399, "en_US");

    expect(getCachedSelector(7, 399, "es_ES")).toEqual(selector);
    expect(getCachedSelector(7, 399, "en_US")).toEqual(selector);
    expect(getCachedSelector(8, 399, "es_ES")).toBeNull();
    expect(dataSource.getKeystoneSelector).toHaveBeenCalledTimes(2);
  });

  it("prefetches only the list and selected detail and shares those in-flight requests", async () => {
    const dataSource = source();

    await Promise.all([prefetchTeamsSession(dataSource), prefetchTeamsSession(dataSource)]);

    expect(dataSource.listTeams).toHaveBeenCalledOnce();
    expect(dataSource.getTeam).toHaveBeenCalledOnce();
    expect(dataSource.getTeam).toHaveBeenCalledWith(7);
    expect(dataSource.getKeystoneSelector).not.toHaveBeenCalled();
    expect(getTeamsSessionSnapshot().selectedTeamId).toBe(7);
  });

  it("clears all private data, selected Team and in-flight identity at an auth boundary", async () => {
    const dataSource = source();
    await loadTeams(dataSource);
    await loadTeamDetail(dataSource, 7);
    await loadSelector(dataSource, 7, 399, "es_ES");
    setSelectedTeamId(7);

    clearTeamsSessionCache();

    expect(getTeamsSessionSnapshot()).toEqual({ teams: null, selectedTeamId: null });
    expect(getCachedTeamDetail(7)).toBeNull();
    expect(getCachedSelector(7, 399, "es_ES")).toBeNull();
  });

  it("does not let a request from the previous auth generation repopulate the cache", async () => {
    let resolveList!: (value: typeof teams) => void;
    const dataSource = source({
      listTeams: vi.fn(() => new Promise<typeof teams>(resolve => { resolveList = resolve; })),
    });
    const staleRequest = loadTeams(dataSource);

    clearTeamsSessionCache();
    resolveList(teams);
    await staleRequest;

    expect(getTeamsSessionSnapshot()).toEqual({ teams: null, selectedTeamId: null });
  });

  it("prunes private detail and Selector data when list revalidation removes Team access", async () => {
    const listTeams = vi.fn()
      .mockResolvedValueOnce(teams)
      .mockResolvedValueOnce([]);
    const dataSource = source({ listTeams });
    await loadTeams(dataSource);
    await loadTeamDetail(dataSource, 7);
    await loadSelector(dataSource, 7, 399, "es_ES");

    await loadTeams(dataSource);

    expect(getCachedTeamDetail(7)).toBeNull();
    expect(getCachedSelector(7, 399, "es_ES")).toBeNull();
  });
});
