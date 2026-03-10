import { describe, expect, it, mock } from 'bun:test';
import { Readable } from 'stream';
import { Savim } from 'savim';

import {
  SavimGoogleDriveProvider,
  SavimGoogleDriveProviderConfig,
} from '../src';

const mockStream = new Readable();
mockStream._read = () => {};
mockStream.push('test');
mockStream.push(null);

mock.module('googleapis', () => {
  return {
    google: {
      drive: mock().mockImplementation(() => {
        return {
          drives: {
            list: mock().mockImplementation(() => {
              if (process.env.ERROR === 'true') {
                throw new Error('test');
              }

              return {};
            }),
          },
          files: {
            get: mock().mockImplementation(() => {
              return {
                data: mockStream,
              };
            }),
            delete: mock().mockImplementation(() => {
              return {
                data: { id: '1' },
              };
            }),
            create: mock().mockImplementation(() => {
              return {
                data: { id: '1' },
              };
            }),
            list: mock().mockImplementation(() => {
              return {
                data: {
                  files: [{ name: '1', id: 'folder-id-1' }],
                },
              };
            }),
          },
        };
      }),
    },
  };
});

describe('Savim GoogleDrive', () => {
  it('should be Defined', () => {
    expect(Savim).toBeDefined();
  });
  it('should be able to define log', () => {
    expect(new Savim('debug')).toBeDefined();
  });
  it('should be able to add provider', async () => {
    const savim = new Savim();
    try {
      process.env.ERROR = 'true';
      await savim.addProvider<SavimGoogleDriveProviderConfig>(
        SavimGoogleDriveProvider,
        '',
      );
    } catch (_error) {
      process.env.ERROR = 'false';
      expect(savim).toBeDefined();
      expect(savim.providers).toBeDefined();
      expect(Object.keys(savim.providers)).toHaveLength(0);
    }

    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    expect(savim).toBeDefined();
    expect(savim.providers).toBeDefined();
    expect(Object.keys(savim.providers)).toHaveLength(1);
  });
  it('should be able to upload file (string)', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    const fileName = '/testupload.txt';
    const fileContent = 'test';
    await savim.uploadFile(fileName, fileContent);
  });
  it('should be able to upload file (buffer)', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    const fileName = '/testuploadbuffer.txt';
    const fileContent = 'test';
    await savim.uploadFile(fileName, Buffer.from(fileContent, 'utf8'));
  });
  it('should be able to upload file (stream)', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    const fileName = '/testuploadstream.txt';
    const fileContent = 'test';
    const s = new Readable();
    s.push(fileContent);
    s.push(null);
    await savim.uploadFile(fileName, s);
  });
  it('should be able to get file', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    const fileName = '/testupload.txt';
    const fileContent = 'test';
    expect(
      Buffer.from(
        (await savim.getFile(fileName)) as string,
        'base64',
      ).toString(),
    ).toEqual(fileContent);
  });
  it('should be able to delete file', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    const fileName = '/testupload.txt';
    await savim.deleteFile(fileName);
  });

  it('should be able to create folder', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    await savim.createFolder('/toto/createfolder');
  });

  it('should be able to delete folder', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    await savim.deleteFolder('/toto/deletefolder');
  });

  it('should be able to list folders from root', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    const result = await savim.getFolders('/');
    expect(result).toBeDefined();
  });

  it('should be able to list folders from subfolder', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    const result = await savim.getFolders('/subfolder');
    expect(result).toBeDefined();
  });

  it('should be able to list files from root', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    const result = await savim.getFiles('/');
    expect(result).toBeDefined();
  });

  it('should be able to list files from subfolder', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    const result = await savim.getFiles('/subfolder');
    expect(result).toBeDefined();
  });
});
