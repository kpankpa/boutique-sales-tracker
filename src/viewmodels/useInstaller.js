'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from './api';

const emptyForm = {
  companyName: '',
  branches: [{ name: '', code: '' }],
  admin: { name: '', username: '', password: '', confirm: '' },
  seed: true
};

export function useInstaller() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet('/status').then(setStatus).catch((failure) => setError(failure.message));
  }, []);

  const setCompanyName = (value) => setForm((current) => ({ ...current, companyName: value }));
  const setSeed = (value) => setForm((current) => ({ ...current, seed: value }));

  const setAdminField = (field, value) => {
    setForm((current) => ({
      ...current,
      admin: { ...current.admin, [field]: value }
    }));
  };

  const setBranchField = (index, field, value) => {
    setForm((current) => ({
      ...current,
      branches: current.branches.map((branch, position) =>
        position === index ? { ...branch, [field]: value } : branch
      )
    }));
  };

  const addBranch = () => {
    setForm((current) => ({
      ...current,
      branches: [...current.branches, { name: '', code: '' }]
    }));
  };

  const removeBranch = (index) => {
    setForm((current) => ({
      ...current,
      branches: current.branches.filter((_, position) => position !== index)
    }));
  };

  const prepare = async () => {
    setBusy(true);
    setError('');
    try {
      await apiPost('/install', { action: 'prepare' });
      setStep(1);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (form.admin.password !== form.admin.confirm) {
      setError('The admin passwords do not match.');
      return false;
    }

    setBusy(true);
    setError('');
    try {
      await apiPost('/install', {
        action: 'finish',
        companyName: form.companyName,
        branches: form.branches,
        seed: form.seed,
        admin: {
          name: form.admin.name,
          username: form.admin.username,
          password: form.admin.password
        }
      });
      return true;
    } catch (failure) {
      setError(failure.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    step,
    setStep,
    form,
    status,
    busy,
    error,
    setCompanyName,
    setSeed,
    setAdminField,
    setBranchField,
    addBranch,
    removeBranch,
    prepare,
    finish
  };
}
