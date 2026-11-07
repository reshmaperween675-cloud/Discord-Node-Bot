import { REST, Routes } from "discord.js";
import type { Client } from "discord.js";
import { getLowoOwnerId } from "../utility/lowoOwner.js";

import { data as setupPanelData } from "../commands/setupChallengePanel.js";
import {
  setupLeaderboardData,
  addPlayerData,
  removePlayerData,
  editPlayerData,
} from "../leaderboard/commands.js";
import {
  setupMobileLeaderboardData,
  addMobilePlayerData,
  removeMobilePlayerData,
  editMobilePlayerData,
} from "../leaderboard/mobileCommands.js";
import { setupKillLeaderboardData } from "../killLeaderboard/display.js";
import {
  addKillPlayerData,
  editKillPlayerData,
  moveKillPlayerData,
  removeKillPlayerData,
} from "../killLeaderboard/commands.js";
import { startRaidData, endRaidData } from "../raids/index.js";
import { raidCallData } from "../raids/announce.js";
import {
  rankData,
  leaderboardLevelData,
  weeklyLbData,
  addXpData,
  removeXpData,
  setXpData,
  resetXpData,
  exportDataData,
  setLevelRoleData,
  removeLevelRoleData,
  setXpCooldownData,
  setXpRangeData,
  setXpChannelData,
  setMultiplierData,
  blacklistChannelData,
  whitelistChannelData,
  xpConfigData,
  levelRolesData,
  startLsXpSystemData,
  stopLsXpSystemData,
} from "../leveling/commands.js";
import { dashboardData } from "../leveling/dashboard.js";
import { universalLeaderboardData } from "../leveling/universalLeaderboard.js";
import { helpData } from "../commands/help.js";
import { purgeConfigData } from "../moderation/purge.js";
import {
  lowoEnableData,
  lowoDisableData,
  lowoDynamicEnableData,
  lowoDynamicDisableData,
  lowoadminData,
} from "../lowo/slashCommands.js";
import { trainingData } from "../training/index.js";
import { promoteData, demoteData } from "../promotions/index.js";
import {
  mvpData,
} from "../utility/index.js";
import { backupDbData } from "../utility/backup.js";
import { setupRulesData } from "../rules/index.js";
import { tournamentData, closeTournamentData } from "../tournament/index.js";
import { censorData, stopcensorData } from "../moderation/commands.js";
import {
  kickData,
  banData,
  tempbanData,
  timeoutData,
  purgeData,
  unlockData,
} from "../moderation/modActions.js";
import {
  setupData,
  setroleData,
  adminBackupData,
} from "../admin/commands.js";
import {
  userinfoData,
  serverinfoData,
  avatarData,
  afkData,
  botinfoData,
  pingData,
  translateData,
} from "../utility/utilCommands.js";
import { creatorData } from "../commands/creator.js";
import { sayData } from "../commands/say.js";

const SLASH_COMMANDS: unknown[] = [
  setupPanelData.toJSON(),
  setupLeaderboardData.toJSON(),
  addPlayerData.toJSON(),
  removePlayerData.toJSON(),
  editPlayerData.toJSON(),
  setupMobileLeaderboardData.toJSON(),
  addMobilePlayerData.toJSON(),
  removeMobilePlayerData.toJSON(),
  editMobilePlayerData.toJSON(),
  setupKillLeaderboardData.toJSON(),
  addKillPlayerData.toJSON(),
  editKillPlayerData.toJSON(),
  removeKillPlayerData.toJSON(),
  moveKillPlayerData.toJSON(),
  startRaidData.toJSON(),
  endRaidData.toJSON(),
  raidCallData.toJSON(),
  trainingData.toJSON(),
  promoteData.toJSON(),
  demoteData.toJSON(),
  mvpData.toJSON(),
  setupRulesData.toJSON(),
  tournamentData.toJSON(),
  closeTournamentData.toJSON(),
  censorData.toJSON(),
  stopcensorData.toJSON(),
  rankData.toJSON(),
  leaderboardLevelData.toJSON(),
  weeklyLbData.toJSON(),
  addXpData.toJSON(),
  removeXpData.toJSON(),
  setXpData.toJSON(),
  resetXpData.toJSON(),
  exportDataData.toJSON(),
  backupDbData.toJSON(),
  setLevelRoleData.toJSON(),
  removeLevelRoleData.toJSON(),
  setXpCooldownData.toJSON(),
  setXpRangeData.toJSON(),
  setXpChannelData.toJSON(),
  setMultiplierData.toJSON(),
  blacklistChannelData.toJSON(),
  whitelistChannelData.toJSON(),
  xpConfigData.toJSON(),
  levelRolesData.toJSON(),
  startLsXpSystemData.toJSON(),
  stopLsXpSystemData.toJSON(),
  dashboardData.toJSON(),
  universalLeaderboardData.toJSON(),
  kickData.toJSON(),
  banData.toJSON(),
  tempbanData.toJSON(),
  timeoutData.toJSON(),
  purgeData.toJSON(),
  unlockData.toJSON(),
  setupData.toJSON(),
  setroleData.toJSON(),
  adminBackupData.toJSON(),
  userinfoData.toJSON(),
  serverinfoData.toJSON(),
  avatarData.toJSON(),
  afkData.toJSON(),
  botinfoData.toJSON(),
  pingData.toJSON(),
  translateData.toJSON(),
  creatorData.toJSON(),
  sayData.toJSON(),
];

export const BASE_COMMANDS: unknown[] = [
  ...SLASH_COMMANDS,
  helpData.toJSON(),
  purgeConfigData.toJSON(),
  lowoEnableData.toJSON(),
  lowoDisableData.toJSON(),
  lowoDynamicEnableData.toJSON(),
  lowoDynamicDisableData.toJSON(),
  lowoadminData.toJSON(),
];

export async function patchSayPermissions(
  client: Client,
  rest: REST,
  guildId: string,
): Promise<void> {
  try {
    const commands = (await rest.get(
      Routes.applicationGuildCommands(client.user!.id, guildId),
    )) as { id: string; name: string }[];
    const sayCommand = commands.find((cmd) => cmd.name === "say");
    if (!sayCommand) return;

    const lowoOwnerId = getLowoOwnerId();
    const guild = client.guilds.cache.get(guildId);
    const guildOwnerId = guild?.ownerId;

    const permissions: { id: string; type: "USER"; permission: boolean }[] = [];
    if (guildOwnerId) {
      permissions.push({ id: guildOwnerId, type: "USER", permission: true });
    }
    if (lowoOwnerId) {
      permissions.push({ id: lowoOwnerId, type: "USER", permission: true });
    }

    if (permissions.length > 0) {
      await rest.put(
        Routes.applicationCommandPermissions(
          client.user!.id,
          guildId,
          sayCommand.id,
        ),
        { body: { permissions } },
      );
    }
  } catch (err) {
    console.error(`[REGISTRY] Failed to patch /say permissions for guild ${guildId}:`, err);
  }
}

export function makeReregister(
  client: Client,
  rest: REST,
): () => Promise<void> {
  return async () => {
    const guilds = [...client.guilds.cache.keys()];
    await Promise.all(
      guilds.map(async (guildId) => {
        try {
          await rest.put(Routes.applicationGuildCommands(client.user!.id, guildId), {
            body: BASE_COMMANDS,
          });
          console.log(`[TOGGLE] Re-registered commands for guild ${guildId}`);
          await patchSayPermissions(client, rest, guildId);
        } catch (err) {
          console.error(`[TOGGLE] Failed for guild ${guildId}:`, err);
        }
      }),
    );
  };
}
