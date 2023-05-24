/* eslint-disable @typescript-eslint/ban-ts-comment */

import {
  BaseExternalAccountClient,
  GoogleAuth,
  OAuth2Client,
} from 'google-auth-library';
import { google } from 'googleapis';
import { drive_v3 } from 'googleapis/build/src/apis/drive/v3';
import { SavimProviderInterface } from 'savim';
import { Readable, Stream } from 'stream';

export type SavimGoogleDriveProviderConfig =
  | GoogleAuth
  | OAuth2Client
  | BaseExternalAccountClient
  | string;

//Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
function replaceAll(str: string, match: string, replacement: string) {
  return str.replace(new RegExp(escapeRegExp(match), 'g'), () => replacement);
}

const resolvePathToGetFolderId = async (
  client: drive_v3.Drive,
  path: string,
) => {
  let foldersArray = path.substring(1).split('/');

  if (foldersArray.length !== 1) {
    foldersArray = foldersArray.slice(0, -1);
  } else {
    foldersArray = [];
  }

  let folderId;

  for (const folderName of foldersArray) {
    //@ts-ignore
    const folders = await client.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = '${replaceAll(
        folderName,
        "'",
        `'"'"'`,
      )}'${
        folderId ? ` and '${folderId}' in parents` : ` and 'root' in parents`
      }`,
      fields: 'files(id, name)',
    });

    if (!folders.data.files || folders.data.files.length === 0) {
      throw new Error(`Folder '${folderName}' not found`);
    }

    folderId = folders.data.files[0].id;
  }

  return folderId as string;
};

const resolvePathToGetFileId = async (client: drive_v3.Drive, path: string) => {
  let foldersArray = path.substring(1).split('/');
  let fileName;

  if (foldersArray.length !== 1) {
    fileName = foldersArray[foldersArray.length - 1];
    foldersArray = foldersArray.slice(0, -1);
  } else {
    fileName = foldersArray;
    foldersArray = [];
  }

  let folderId;

  for (const folderName of foldersArray) {
    //@ts-ignore
    const folders = await client.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false and name = '${replaceAll(
        folderName,
        "'",
        `'"'"'`,
      )}'${
        folderId ? ` and '${folderId}' in parents` : ` and 'root' in parents`
      }`,
      fields: 'files(id, name)',
    });

    if (!folders.data.files || folders.data.files.length === 0) {
      throw new Error(`Folder '${folderName}' not found`);
    }

    folderId = folders.data.files[0].id;
  }

  const res = await client.files.list({
    q: `trashed = false and name = '${replaceAll(
      fileName as string,
      "'",
      `'"'"'`,
    )}'${
      folderId ? ` and '${folderId}' in parents` : ` and 'root' in parents`
    }`,
    fields: 'files(id, name)',
  });
  const files = res.data.files;

  if (!files || files.length === 0) {
    throw new Error(`File '${fileName}' not found`);
  }

  return files[0].id! as string;
};

const resolvePathToGetFilename = async (path: string) => {
  let foldersArray = path.substring(1).split('/');
  let fileName;

  if (foldersArray.length !== 1) {
    fileName = foldersArray[foldersArray.length - 1];
    foldersArray = foldersArray.slice(0, -1);
  } else {
    fileName = foldersArray[0];
    foldersArray = [];
  }

  return fileName as string;
};

function streamToString(stream: Readable) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chunks: any[] = [];
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
  });
}

export class SavimGoogleDriveProvider implements SavimProviderInterface {
  name = 'google-drive';
  client: drive_v3.Drive;

  constructor(public config: SavimGoogleDriveProviderConfig) {
    //@ts-ignore
    this.client = google.drive({ version: 'v3', auth: config });
  }

  async isHealthy() {
    try {
      await this.client.drives.list();
      return true;
    } catch (err) {
      return false;
    }
  }

  async getFile(filenameWithPath: string) {
    const fileId = await resolvePathToGetFileId(this.client, filenameWithPath);

    const file = await this.client.files.get(
      {
        fileId,
        alt: 'media',
        acknowledgeAbuse: true,
      },
      { responseType: 'stream' },
    );

    return streamToString(file.data);
  }

  async uploadFile(
    filenameWithPath: string,
    content: string | Buffer | Stream,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _config = {},
  ) {
    const fileName = await resolvePathToGetFilename(filenameWithPath);
    const folderId = await resolvePathToGetFolderId(
      this.client,
      filenameWithPath,
    );

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

  async deleteFile(filenameWithPath: string) {
    const fileId = await resolvePathToGetFileId(this.client, filenameWithPath);

    await this.client.files.delete({
      fileId,
    });
  }

  async createFolder(path: string) {
    const fileName = await resolvePathToGetFilename(path);
    const folderId = await resolvePathToGetFolderId(this.client, path);

    const res = await this.client.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: folderId ? [folderId] : [],
      },
      fields: 'id, name',
    });

    return res.data.id;
  }

  async deleteFolder(path: string) {
    const folderId = await resolvePathToGetFileId(this.client, path);

    await this.client.files.delete({
      fileId: folderId,
    });
  }

  async getFolders(path: string) {
    let folderId;

    if (path !== '/') {
      folderId = await resolvePathToGetFileId(this.client, path);
    }

    const res = await this.client.files.list({
      q: `mimeType = 'application/vnd.google-apps.folder' and trashed = false${
        folderId ? ` and '${folderId}' in parents` : ` and 'root' in parents`
      }`,
      fields: 'files(id, name)',
    });

    //@ts-ignore
    return res.data.files?.map((v) => `${path === '/' ? '' : path}/${v.name}`);
  }

  async getFiles(path: string) {
    let folderId;

    if (path !== '/') {
      folderId = await resolvePathToGetFileId(this.client, path);
    }

    const res = await this.client.files.list({
      q: `mimeType != 'application/vnd.google-apps.folder' and trashed = false${
        folderId ? ` and '${folderId}' in parents` : ` and 'root' in parents`
      }`,
      fields: 'files(id, name)',
    });

    //@ts-ignore
    return res.data.files?.map((v) => `${path === '/' ? '' : path}/${v.name}`);
  }
}
