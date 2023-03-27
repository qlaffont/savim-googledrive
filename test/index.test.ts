/* eslint-disable @typescript-eslint/ban-ts-comment */
import { describe, expect, it, jest } from '@jest/globals';
import { Savim } from 'savim';
import { Readable } from 'stream';

import {
  SavimGoogleDriveProvider,
  SavimGoogleDriveProviderConfig,
} from '../src';

jest.mock('googleapis', () => {
  return {
    google: {
      drive: jest.fn().mockImplementation(() => {
        return {
          drives: {
            list: jest.fn().mockImplementation(() => {
              if (process.env.ERROR === 'true') {
                throw new Error('test');
              }

              return {};
            }),
          },
          files: {
            get: jest.fn().mockImplementation(() => {
              return {
                data: 'test',
              };
            }),
            delete: jest.fn().mockImplementation(() => {
              return {
                data: { id: '1' },
              };
            }),
            create: jest.fn().mockImplementation(() => {
              return {
                data: { id: '1' },
              };
            }),
            list: jest.fn().mockImplementation(() => {
              return {
                data: {
                  files: [{ name: '1' }],
                },
              };
            }),
          },
        };
      }),
    },
  };
});

describe('Savim S3', () => {
  it('should be Defined', () => {
    expect(Savim).toBeDefined();
  });
  it('should be able to define log', () => {
    expect(new Savim('debug')).toBeDefined();
  });
  it('should be able to add provider', async () => {
    const savim = new Savim();
    process.env.ERROR = 'true';
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    process.env.ERROR = 'false';
    expect(savim).toBeDefined();
    expect(savim.providers).toBeDefined();
    expect(Object.keys(savim.providers)).toHaveLength(0);
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
    const fileName = 'testupload.txt';
    const fileContent = 'test';
    await savim.uploadFile(fileName, fileContent);
  });
  it('should be able to upload file (buffer)', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    const fileName = 'testuploadbuffer.txt';
    const fileContent = 'test';
    await savim.uploadFile(fileName, Buffer.from(fileContent, 'utf8'));
  });
  it('should be able to upload file (stream)', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    const fileName = 'testuploadstream.txt';
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
    const fileName = 'testupload.txt';
    const fileContent = 'test';
    expect(await savim.getFile(fileName)).toEqual(fileContent);
  });
  it('should be able to delete file', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    const fileName = 'testupload.txt';
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

  it('should be able to list folders', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    await savim.getFolders('');
  });

  it('should be able to list files', async () => {
    const savim = new Savim();
    await savim.addProvider<SavimGoogleDriveProviderConfig>(
      SavimGoogleDriveProvider,
      '',
    );
    await savim.getFiles('');
  });
});
