
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Key, Clock, Search, User, Loader2, Mail, CheckCircle2, AlertCircle, Eye, EyeOff, Hash, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const ManagerUsersScreen: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('usuarios')
                .select('id, nome, senha_hash, nivel_acesso, ativo, ultimo_acesso')
                .not('nivel_acesso', 'ilike', 'admin')
                .not('nivel_acesso', 'ilike', 'gerente')
                .order('nome');

            if (error) throw error;
            setUsers(data || []);
        } catch (e) {
            console.error('Erro ao buscar usuários:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const togglePasswordVisibility = (id: string) => {
        setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return 'NUNCA ACESSOU';
        
        // Garante que a data seja tratada como UTC adicionando o 'Z' se não houver
        const isoString = dateStr.endsWith('Z') || dateStr.includes('-') && dateStr.includes('+') 
            ? dateStr 
            : dateStr.replace(' ', 'T') + 'Z';

        const date = new Date(isoString);
        
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
        });
    };

    const filteredUsers = users.filter(u => 
        u.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-20">
            <header className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-slate-900 text-white rounded-[24px] shadow-xl">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Gestão de Acessos</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Monitoramento de Credenciais e Atividade</p>
                    </div>
                </div>
                
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar representante..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                </div>
            </header>

            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <th className="px-8 py-6">Representante (Login)</th>
                                <th className="px-6 py-6">Senha de Acesso</th>
                                <th className="px-8 py-6 text-right">Último Acesso no Portal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={3} className="px-8 py-20 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando credenciais...</p>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-8 py-20 text-center text-slate-300 font-bold uppercase text-[10px]">
                                        Nenhum usuário encontrado.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 uppercase text-xs border border-slate-200 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                    {user.nome.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-800 uppercase text-xs tracking-tight">{user.nome}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <User className="w-3 h-3 text-blue-500" />
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Login: {user.nome.toLowerCase().replace(/\s/g, '.')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 flex items-center gap-3 min-w-[120px]">
                                                    <Hash className="w-3.5 h-3.5 text-slate-300" />
                                                    <span className="text-xs font-black text-slate-700 tracking-widest tabular-nums">
                                                        {showPasswords[user.id] ? user.senha_hash : '••••••••'}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={() => togglePasswordVisibility(user.id)}
                                                    className="p-2 hover:bg-white hover:shadow-md rounded-xl transition-all text-slate-400 hover:text-blue-600"
                                                >
                                                    {showPasswords[user.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="inline-flex flex-col items-end">
                                                <div className="flex items-center gap-2 text-slate-700 font-black text-[11px] tabular-nums">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-300" />
                                                    {formatDateTime(user.ultimo_acesso)}
                                                </div>
                                                {!user.ativo && (
                                                    <span className="text-[8px] font-black text-red-500 uppercase mt-1 bg-red-50 px-1.5 rounded">Usuário Inativo</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="p-8 bg-slate-900 rounded-[32px] text-white flex flex-col md:flex-row items-center justify-between gap-6 border-b-4 border-blue-600 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-2xl">
                        <AlertCircle className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Dica de Segurança</p>
                        <p className="text-xs font-medium text-slate-400 max-w-md leading-relaxed">Senhas são de uso pessoal e intransferível. Este painel é restrito à gerência para suporte técnico aos representantes.</p>
                    </div>
                </div>
                <div className="bg-white/5 px-6 py-4 rounded-2xl border border-white/5 text-right">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total de Contas</p>
                    <p className="text-2xl font-black text-white">{users.length}</p>
                </div>
            </div>
        </div>
    );
};
