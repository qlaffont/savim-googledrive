import { BaseExternalAccountClient, GoogleAuth, OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { drive_v3 } from "googleapis/build/src/apis/drive/v3";
import { SavimProviderInterface } from "savim";
import { Readable, Stream } from "stream";

export type SavimGoogleDriveProviderConfig =
  | GoogleAuth
  | OAuth2Client
  | BaseExternalAccountClient
  | string;

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAll(str: string, match: string, replacement: string) {
  return str.replace(new RegExp(escapeRegExp(match), "g"), () => replacement);
}

const resolvePathToGetFolderId = async (client: drive_v3.Drive, path: string) => {
  let foldersArray = path.substring(1).split("/");

  if (foldersArray.length !== 1) {
    foldersArray = foldersArray.slice(0, -1);
  } else {
    foldersArray = [];
  }

  let folderId: string | undefined;

  for (const folderName of foldersArray) {
    //@ts-ignore
    const folders = await client.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = '${replaceAll(
        folderName,
        "'",
        `'"'"'`,
      )}'${folderId ? ` and '${folderId}' in parents` : ` and 'root' in parents`}`,
      fields: "files(id, name)",
    });

    if (!folders.data.files || folders.data.files.length === 0) {
      throw new Error(`Folder '${folderName}' not found`);
    }

    folderId = folders.data.files[0].id as string;
  }

  return folderId as string;
};

const resolvePathToGetFileId = async (client: drive_v3.Drive, path: string) => {
  const correctPath = path.startsWith("/") ? path : `/${path}`;
  let foldersArray = correctPath.substring(1).split("/");
  let fileName: string;

  if (foldersArray.length !== 1) {
    fileName = foldersArray[foldersArray.length - 1];
    foldersArray = foldersArray.slice(0, -1);
  } else {
    fileName = foldersArray[0];
    foldersArray = [];
  }

  let folderId: string | undefined;

  for (const folderName of foldersArray) {
    //@ts-ignore
    const folders = await client.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = '${replaceAll(
        folderName,
        "'",
        `'"'"'`,
      )}'${folderId ? ` and '${folderId}' in parents` : ` and 'root' in parents`}`,
      fields: "files(id, name)",
    });

    if (!folders.data.files || folders.data.files.length === 0) {
      throw new Error(`Folder '${folderName}' not found`);
    }

    folderId = folders.data.files[0].id as string;
  }

  const res = await client.files.list({
    q: `trashed = false and name = '${replaceAll(fileName, "'", `'"'"'`)}'${
      folderId ? ` and '${folderId}' in parents` : ` and 'root' in parents`
    }`,
    fields: "files(id, name)",
  });
  const files = res.data.files;

  if (!files || files.length === 0) {
    throw new Error(`File '${fileName}' not found`);
  }

  return files[0].id! as string;
};

const resolvePathToGetFilename = async (path: string) => {
  const foldersArray = path.substring(1).split("/");

  if (foldersArray.length !== 1) {
    return foldersArray[foldersArray.length - 1];
  }

  return foldersArray[0];
};

function streamToString(stream: Readable) {
  const chunks: Buffer[] = [];
  return new Promise<string>((resolve, reject) => {
    //@ts-ignore
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
  });
}

export class SavimGoogleDriveProvider implements SavimProviderInterface {
  name = "google-drive";
  client: drive_v3.Drive;

  constructor(public config: SavimGoogleDriveProviderConfig) {
    //@ts-ignore
    this.client = google.drive({ version: "v3", auth: config });
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.drives.list();
      return true;
      // oxlint-disable-next-line no-unused-vars
    } catch (_err) {
      return false;
    }
  }

  async getFile(filenameWithPath: string): Promise<string> {
    const fileId = await resolvePathToGetFileId(this.client, filenameWithPath);

    const file = await this.client.files.get(
      {
        fileId,
        alt: "media",
        acknowledgeAbuse: true,
      },
      { responseType: "stream" },
    );

    return streamToString(file.data);
  }

  async uploadFile(
    filenameWithPath: string,
    content: string | Buffer | Stream,
    _config = {},
  ): Promise<string | null | undefined> {
    const fileName = await resolvePathToGetFilename(filenameWithPath);
    const folderId = await resolvePathToGetFolderId(this.client, filenameWithPath);

    const res = await this.client.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        body: content,
      },
    });

    return res.data.id;
  }

  async deleteFile(filenameWithPath: string): Promise<void> {
    const fileId = await resolvePathToGetFileId(this.client, filenameWithPath);

    await this.client.files.delete({
      fileId,
    });
  }

  async createFolder(path: string): Promise<string | null | undefined> {
    const fileName = await resolvePathToGetFilename(path);
    const folderId = await resolvePathToGetFolderId(this.client, path);

    const res = await this.client.files.create({
      requestBody: {
        name: fileName,
        mimeType: "application/vnd.google-apps.folder",
        parents: folderId ? [folderId] : [],
      },
      fields: "id, name",
    });

    return res.data.id;
  }

  async deleteFolder(path: string): Promise<void> {
    const folderId = await resolvePathToGetFileId(this.client, path);

    await this.client.files.delete({
      fileId: folderId,
    });
  }

  async getFolders(path: string): Promise<string[] | undefined> {
    let folderId: string | undefined;

    if (path !== "/") {
      folderId = await resolvePathToGetFileId(this.client, path);
    }

    const res = await this.client.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false${
        folderId ? ` and '${folderId}' in parents` : ` and 'root' in parents`
      }`,
      fields: "files(id, name)",
    });

    //@ts-ignore
    return res.data.files?.map((v) => `${path === "/" ? "" : path}/${v.name}`);
  }

  async getFiles(path: string): Promise<string[] | undefined> {
    let folderId: string | undefined;

    if (path !== "/") {
      folderId = await resolvePathToGetFileId(this.client, path);
    }

    const res = await this.client.files.list({
      q: `mimeType != 'application/vnd.google-apps.folder' and trashed = false${
        folderId ? ` and '${folderId}' in parents` : ` and 'root' in parents`
      }`,
      fields: "files(id, name)",
    });

    //@ts-ignore
    return res.data.files?.map((v) => `${path === "/" ? "" : path}/${v.name}`);
  }
}
