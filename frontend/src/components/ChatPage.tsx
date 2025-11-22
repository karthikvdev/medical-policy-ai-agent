import Chatbot from "./Chatbot";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import apiService from "../services/base.service";
import type { Conversation } from "../interface";
import ConfirmDialog from "./ConfirmDialog";
import { FileText, Plus, MessageSquare, Trash2 } from "lucide-react";

export default function ChatPage() {
    const { conversationId } = useParams<{ conversationId: string }>();
    const navigate = useNavigate();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [conversationToDelete, setConversationToDelete] = useState<number | null>(null);

    useEffect(() => {
        fetchConversations();
    }, []);

    const fetchConversations = async () => {
        try {
            const data = await apiService.getConversations();
            setConversations(data);
        } catch (err) {
            console.error('Failed to fetch conversations:', err);
        }
    };

    const handleSelectConversation = (conv: Conversation) => {
        navigate(`/chat/${conv.id}`);
    };

    const handleNewChat = () => {
        navigate('/');
    };

    const handleDeleteClick = (convId: number, event: React.MouseEvent) => {
        event.stopPropagation();
        setConversationToDelete(convId);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!conversationToDelete) return;

        try {
            await apiService.deleteConversation(conversationToDelete);

            // Check if we're deleting the current conversation
            if (conversationId && String(conversationToDelete) === conversationId) {
                // Navigate to home if current conversation is deleted
                navigate('/');
            } else {
                // Refresh the conversation list
                await fetchConversations();
            }
        } catch (err) {
            console.error('Error deleting conversation:', err);
        } finally {
            setDeleteDialogOpen(false);
            setConversationToDelete(null);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteDialogOpen(false);
        setConversationToDelete(null);
    };

    return (
        <>
            {deleteDialogOpen && <ConfirmDialog
                isOpen={deleteDialogOpen}
                title="Delete conversation?"
                message="This will permanently delete this conversation and all its messages. This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
            />}
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100">
                <div className="container mx-auto px-4 py-8">
                    <header className="mb-8 text-center">
                        <div className="flex items-center justify-center mb-4">
                            <FileText className="w-12 h-12 text-blue-600 mr-3" />
                            <h1 className="text-4xl font-bold text-gray-900">
                                Medical Policy Assistant
                            </h1>
                        </div>
                        <p className="text-gray-600 text-lg">
                            Upload your hospital bill and get instant answers about your insurance coverage
                        </p>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        <div className="lg:col-span-1 space-y-6">
                            <button
                                onClick={handleNewChat}
                                className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                            >
                                <Plus className="w-5 h-5" />
                                <span>New Chat</span>
                            </button>

                            {conversations.length > 0 && (
                                <div className="bg-white rounded-lg shadow-md p-4">
                                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                                        <MessageSquare className="w-5 h-5 mr-2 text-blue-600" />
                                        Previous Conversations
                                    </h3>
                                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                        {conversations.map((conv) => (
                                            <div
                                                key={conv.id}
                                                className="relative group"
                                            >
                                                <button
                                                    onClick={() => handleSelectConversation(conv)}
                                                    className={`w-full text-left p-3 pr-12 rounded-lg transition-colors ${conversationId === String(conv.id)
                                                        ? 'bg-blue-100 border-2 border-blue-500'
                                                        : 'bg-gray-50 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    <div className="font-medium text-sm text-gray-900">
                                                        {conv.insurer} - {conv.plan}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {new Date(conv.updated_at).toLocaleDateString()} {new Date(conv.updated_at).toLocaleTimeString()}
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteClick(conv.id, e)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Delete conversation"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="lg:col-span-2">
                            <Chatbot
                                conversationId={conversationId ? parseInt(conversationId) : null}
                                onConversationsUpdate={fetchConversations}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
